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

  // KYC events
  KYC_REQUIREMENTS_PUBLISHED: 'Kyc.RequirementsPublished.v1',
  KYC_SUBMITTED: 'Kyc.Submitted.v1',
  KYC_REVIEW_ASSIGNED: 'Kyc.ReviewAssigned.v1',
  KYC_APPROVED: 'Kyc.Approved.v1',
  KYC_REJECTED: 'Kyc.Rejected.v1',
  KYC_TIER_UPGRADED: 'Kyc.TierUpgraded.v1',

  // Merchant/Agent events
  STORE_CREATED: 'Merchant.StoreCreated.v1',
  AGENT_CREATED: 'Agent.Created.v1',
  AGENT_UPDATED: 'Agent.Updated.v1',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
