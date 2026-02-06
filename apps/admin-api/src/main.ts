import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AdminModule } from './admin.module';
import { createPool } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import helmet from 'helmet';
import { API_PREFIX } from '@caricash/common';

async function bootstrap() {
  const logger = createLogger({ name: 'admin-api' });

  createPool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://caricash:caricash_dev@localhost:5432/caricash',
  });

  const app = await NestFactory.create(AdminModule);
  app.use(helmet());
  app.setGlobalPrefix(API_PREFIX);

  const port = Number(process.env.ADMIN_PORT ?? 3001);
  await app.listen(port);
  logger.info(`Admin API listening on port ${port}`);
}

bootstrap();
