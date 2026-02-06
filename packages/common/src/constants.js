"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUNDING_MODE = exports.OUTBOX_BATCH_SIZE = exports.OUTBOX_MAX_RETRIES = exports.OUTBOX_POLL_INTERVAL_MS = exports.REQUEST_ID_HEADER = exports.CORRELATION_ID_HEADER = exports.IDEMPOTENCY_KEY_HEADER = exports.PIN_LOCKOUT_MINUTES = exports.MAX_PIN_ATTEMPTS = exports.JWT_REFRESH_TTL_SECONDS = exports.JWT_ACCESS_TTL_SECONDS = exports.DEFAULT_CURRENCY_DECIMALS = exports.DEFAULT_COUNTRY = exports.DEFAULT_CURRENCY = exports.API_PREFIX = exports.API_VERSION = void 0;
exports.API_VERSION = 'v1';
exports.API_PREFIX = `/api/${exports.API_VERSION}`;
exports.DEFAULT_CURRENCY = 'BBD';
exports.DEFAULT_COUNTRY = 'BB';
exports.DEFAULT_CURRENCY_DECIMALS = 2;
exports.JWT_ACCESS_TTL_SECONDS = 900; // 15 minutes
exports.JWT_REFRESH_TTL_SECONDS = 604800; // 7 days
exports.MAX_PIN_ATTEMPTS = 5;
exports.PIN_LOCKOUT_MINUTES = 30;
exports.IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
exports.CORRELATION_ID_HEADER = 'x-correlation-id';
exports.REQUEST_ID_HEADER = 'x-request-id';
exports.OUTBOX_POLL_INTERVAL_MS = 1000;
exports.OUTBOX_MAX_RETRIES = 5;
exports.OUTBOX_BATCH_SIZE = 50;
exports.ROUNDING_MODE = 'HALF_EVEN'; // Banker's rounding
//# sourceMappingURL=constants.js.map