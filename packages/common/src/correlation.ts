import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new correlation ID.
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Generate a new request ID.
 */
export function generateRequestId(): string {
  return uuidv4();
}
