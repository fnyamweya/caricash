/**
 * Payment state machine: defines valid transitions for payment workflows.
 *
 * Workflow: Initiated → Authorized → LedgerPosted → Notified → Completed
 * Failures go to Failed with reason codes from any non-terminal state.
 */
import { PaymentStatus } from './types';

/** Valid state transitions map */
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  INITIATED: ['AUTHORIZED', 'FAILED'],
  AUTHORIZED: ['LEDGER_POSTED', 'FAILED'],
  LEDGER_POSTED: ['NOTIFIED', 'FAILED'],
  NOTIFIED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],   // terminal
  FAILED: [],      // terminal
};

/** Terminal states that cannot transition further */
export const TERMINAL_STATES: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  'COMPLETED',
  'FAILED',
]);

/** The ordered happy-path sequence */
export const HAPPY_PATH: readonly PaymentStatus[] = [
  'INITIATED',
  'AUTHORIZED',
  'LEDGER_POSTED',
  'NOTIFIED',
  'COMPLETED',
] as const;

/**
 * Check whether a transition from `from` to `to` is valid.
 */
export function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  const allowed = TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Get the next happy-path status after `current`, or undefined if terminal.
 */
export function nextHappyPathStatus(current: PaymentStatus): PaymentStatus | undefined {
  const idx = HAPPY_PATH.indexOf(current);
  if (idx === -1 || idx >= HAPPY_PATH.length - 1) return undefined;
  return HAPPY_PATH[idx + 1];
}

/**
 * Check whether a status is terminal (no further transitions allowed).
 */
export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Get all valid next states from the current status.
 */
export function validNextStates(current: PaymentStatus): PaymentStatus[] {
  return [...(TRANSITIONS[current] ?? [])];
}
