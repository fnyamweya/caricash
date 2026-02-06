import * as amqp from 'amqplib';
import { queryOne, query } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import { EventTypes } from '@caricash/events';

const logger = createLogger({ name: 'audit-indexer' });

/**
 * Audit Indexer Worker
 * Consumes AuditRecorded events and indexes them to Elasticsearch.
 * Elasticsearch is NOT the system of record; Postgres audit_events is.
 */
export class AuditIndexer {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly CONSUMER_GROUP = 'audit-indexer';
  private readonly esUrl: string;

  constructor(private readonly rabbitmqUrl: string) {
    this.esUrl = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200';
  }

  async start(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange('caricash.events', 'topic', { durable: true });
      const q = await this.channel.assertQueue('audit-indexer', { durable: true });
      await this.channel.bindQueue(q.queue, 'caricash.events', EventTypes.AUDIT_RECORDED);
      await this.channel.prefetch(10);

      await this.channel.consume(q.queue, async (msg) => {
        if (!msg) return;
        try {
          const envelope = JSON.parse(msg.content.toString());
          await this.processMessage(envelope);
          this.channel?.ack(msg);
        } catch (err) {
          logger.error({ err }, 'Audit indexer processing error');
          this.channel?.nack(msg, false, true);
        }
      });

      logger.info('Audit indexer worker started');
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ not available for audit indexer, will retry');
      setTimeout(() => this.start(), 5000);
    }
  }

  async stop(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async processMessage(envelope: { eventId: string; payload: Record<string, unknown> }): Promise<void> {
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

    // Index to Elasticsearch (best-effort)
    try {
      const response = await fetch(`${this.esUrl}/caricash-audit/_doc/${envelope.payload.auditEventId ?? envelope.eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope.payload),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, 'ES indexing failed, will still mark as processed');
      }
    } catch (err) {
      logger.warn({ err }, 'ES not available, skipping indexing');
    }

    // Record in inbox
    await query(
      'INSERT INTO inbox_events (message_id, consumer_group) VALUES ($1, $2)',
      [messageId, this.CONSUMER_GROUP],
    );
  }
}
