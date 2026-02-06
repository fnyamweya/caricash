export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

export const DEFAULT_CURRENCY = 'BBD';
export const DEFAULT_COUNTRY = 'BB';
export const DEFAULT_CURRENCY_DECIMALS = 2;

export const JWT_ACCESS_TTL_SECONDS = 900;       // 15 minutes
export const JWT_REFRESH_TTL_SECONDS = 604800;    // 7 days

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 30;

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

export const OUTBOX_POLL_INTERVAL_MS = 1000;
export const OUTBOX_MAX_RETRIES = 5;
export const OUTBOX_BATCH_SIZE = 50;

export const ROUNDING_MODE = 'HALF_EVEN';   // Banker's rounding
