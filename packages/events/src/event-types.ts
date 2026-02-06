/**
 * Canonical event type names for Caricash domain events.
 * Format: Domain.Action.vN
 */
export const EventTypes = {
  // Ledger events
  LEDGER_POSTED: 'Ledger.Posted.v1',
  LEDGER_REVERSED: 'Ledger.Reversed.v1',

  // Audit events
  AUDIT_RECORDED: 'Audit.Recorded.v1',

  // Identity events
  PRINCIPAL_CREATED: 'Identity.PrincipalCreated.v1',
  PRINCIPAL_LOCKED: 'Identity.PrincipalLocked.v1',
  AUTH_LOGIN: 'Identity.Login.v1',
  AUTH_LOGOUT: 'Identity.Logout.v1',

  // Config events
  CONFIG_UPDATED: 'Config.Updated.v1',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
