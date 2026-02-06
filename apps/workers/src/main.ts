import { createPool } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import { OutboxPublisher } from './outbox-publisher';
import { BalanceProjectionWorker } from './balance-projection';
import { AuditIndexer } from './audit-indexer';

const logger = createLogger({ name: 'workers' });

async function main() {
  createPool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://caricash:caricash_dev@localhost:5432/caricash',
  });

  const rabbitmqUrl = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

  logger.info('Starting workers...');

  // Start outbox publisher
  const outbox = new OutboxPublisher(rabbitmqUrl);
  await outbox.start();

  // Start balance projection worker
  const balanceWorker = new BalanceProjectionWorker(rabbitmqUrl);
  await balanceWorker.start();

  // Start audit indexer
  const auditIndexer = new AuditIndexer(rabbitmqUrl);
  await auditIndexer.start();

  logger.info('All workers started');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await outbox.stop();
    await balanceWorker.stop();
    await auditIndexer.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Worker startup failed');
  process.exit(1);
});
