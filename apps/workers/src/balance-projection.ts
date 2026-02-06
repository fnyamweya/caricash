import * as amqp from 'amqplib';
import { query, queryOne } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import { EventTypes } from '@caricash/events';

const logger = createLogger({ name: 'balance-projection' });

/**
 * Balance Projection Worker
 * Consumes LedgerPosted events and updates account_balance_projections.
 * NOTE: This projection is NOT the source of truth. Truth = journal_lines.
 */
export class BalanceProjectionWorker {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly CONSUMER_GROUP = 'balance-projection';

  constructor(private readonly rabbitmqUrl: string) {}

  async start(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange('caricash.events', 'topic', { durable: true });
      const q = await this.channel.assertQueue('balance-projection', { durable: true });
      await this.channel.bindQueue(q.queue, 'caricash.events', EventTypes.LEDGER_POSTED);
      await this.channel.bindQueue(q.queue, 'caricash.events', EventTypes.LEDGER_REVERSED);
      await this.channel.prefetch(10);

      await this.channel.consume(q.queue, async (msg) => {
        if (!msg) return;
        try {
          const envelope = JSON.parse(msg.content.toString());
          await this.processMessage(envelope);
          this.channel?.ack(msg);
        } catch (err) {
          logger.error({ err }, 'Balance projection processing error');
          this.channel?.nack(msg, false, true);
        }
      });

      logger.info('Balance projection worker started');
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ not available for balance projection, will retry');
      setTimeout(() => this.start(), 5000);
    }
  }

  async stop(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async processMessage(envelope: { eventId: string; payload: { entryId: string; lines: Array<{ accountId: string; debitCredit: string; amount: string; currencyCode: string }> } }): Promise<void> {
    // Inbox dedup
    const messageId = envelope.eventId;
    const existing = await queryOne(
      'SELECT 1 FROM inbox_events WHERE message_id = $1 AND consumer_group = $2',
      [messageId, this.CONSUMER_GROUP],
    );
    if (existing) {
      logger.info({ messageId }, 'Duplicate message, skipping');
      return;
    }

    // Process each line to update balance projection
    for (const line of envelope.payload.lines) {
      const delta = line.debitCredit === 'DEBIT' ? `-${line.amount}` : line.amount;

      await query(
        `INSERT INTO account_balance_projections (account_id, posted_balance, currency_code, last_entry_id, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (account_id) DO UPDATE SET
           posted_balance = account_balance_projections.posted_balance + $2,
           last_entry_id = $4,
           updated_at = NOW()`,
        [line.accountId, delta, line.currencyCode, envelope.payload.entryId],
      );
    }

    // Record in inbox
    await query(
      'INSERT INTO inbox_events (message_id, consumer_group) VALUES ($1, $2)',
      [messageId, this.CONSUMER_GROUP],
    );
  }
}
