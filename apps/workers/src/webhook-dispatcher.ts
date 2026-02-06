import { createLogger } from '@caricash/observability';

const logger = createLogger({ name: 'webhook-dispatcher' });

/**
 * Webhook Dispatcher (Phase 1 Scaffold)
 * In later phases, this will consume events and dispatch webhooks
 * to registered merchant/partner endpoints.
 */
export class WebhookDispatcher {
  async start(): Promise<void> {
    logger.info('Webhook dispatcher scaffold loaded (no-op in Phase 1)');
  }

  async stop(): Promise<void> {
    // No-op
  }
}
