import pino from 'pino';
import { PII_REDACTION_PATHS } from './pii';

export type Logger = pino.Logger;

/**
 * Create a structured JSON logger with correlation ID support.
 */
export function createLogger(options?: {
  name?: string;
  level?: string;
  correlationId?: string;
  requestId?: string;
}): Logger {
  return pino({
    name: options?.name ?? 'caricash',
    level: options?.level ?? process.env.LOG_LEVEL ?? 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: PII_REDACTION_PATHS,
      censor: '[REDACTED]',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    base: {
      ...(options?.correlationId && { correlationId: options.correlationId }),
      ...(options?.requestId && { requestId: options.requestId }),
    },
  });
}
