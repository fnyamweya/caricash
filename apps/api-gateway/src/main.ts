import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createPool } from '@caricash/db';
import { createLogger } from '@caricash/observability';
import helmet from 'helmet';
import { API_PREFIX } from '@caricash/common';

async function bootstrap() {
  const logger = createLogger({ name: 'api-gateway' });

  createPool({
    connectionString: process.env.DATABASE_URL ?? 'postgresql://caricash:caricash_dev@localhost:5432/caricash',
    min: Number(process.env.DATABASE_POOL_MIN ?? 2),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });

  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.info(`API Gateway listening on port ${port}`);
}

bootstrap();
