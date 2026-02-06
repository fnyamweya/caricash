import * as amqp from 'amqplib';
import { query, queryMany } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import { OUTBOX_POLL_INTERVAL_MS, OUTBOX_BATCH_SIZE, OUTBOX_MAX_RETRIES } from '@caricash/common';
import { createEnvelope } from '@caricash/events';

const logger = createLogger({ name: 'outbox-publisher' });

export class OutboxPublisher {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly rabbitmqUrl: string) {}

  async start(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange('caricash.events', 'topic', { durable: true });

      this.running = true;
      this.timer = setInterval(() => this.poll(), OUTBOX_POLL_INTERVAL_MS);
      logger.info('Outbox publisher started');
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ not available, outbox publisher will retry on next poll');
      this.running = true;
      this.timer = setInterval(() => this.poll(), OUTBOX_POLL_INTERVAL_MS * 5);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      if (!this.channel) {
        this.connection = await amqp.connect(this.rabbitmqUrl);
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange('caricash.events', 'topic', { durable: true });
      }

      const events = await queryMany<{
        id: string; event_type: string; event_id: string;
        correlation_id: string; causation_id: string;
        schema_version: number; payload: unknown;
        retry_count: number;
      }>(
        `SELECT * FROM outbox_events
         WHERE status IN ('PENDING', 'FAILED')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         AND retry_count < max_retries
         ORDER BY created_at ASC
         LIMIT $1`,
        [OUTBOX_BATCH_SIZE],
      );

      for (const event of events) {
        try {
          const envelope = createEnvelope(
            event.event_id,
            event.event_type,
            event.correlation_id,
            event.payload,
            { causationId: event.causation_id, schemaVersion: event.schema_version },
          );

          this.channel.publish(
            'caricash.events',
            event.event_type,
            Buffer.from(JSON.stringify(envelope)),
            { persistent: true, messageId: event.event_id },
          );

          await query(
            `UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1`,
            [event.id],
          );
        } catch (err) {
          const nextRetry = new Date(Date.now() + Math.pow(2, event.retry_count) * 1000);
          await query(
            `UPDATE outbox_events SET status = 'FAILED', retry_count = retry_count + 1, next_retry_at = $1 WHERE id = $2`,
            [nextRetry, event.id],
          );
          logger.error({ err, eventId: event.id }, 'Failed to publish outbox event');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Outbox poll error');
      this.channel = null;
    }
  }
}
