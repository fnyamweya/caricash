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

  // Payment events (Phase 3)
  PAYMENT_INITIATED: 'Payment.Initiated.v1',
  PAYMENT_AUTHORIZED: 'Payment.Authorized.v1',
  PAYMENT_LEDGER_POSTED: 'Payment.LedgerPosted.v1',
  PAYMENT_NOTIFIED: 'Payment.Notified.v1',
  PAYMENT_COMPLETED: 'Payment.Completed.v1',
  PAYMENT_FAILED: 'Payment.Failed.v1',

  // Pricing events (Phase 3)
  PRICING_QUOTE_CREATED: 'Pricing.QuoteCreated.v1',

  // Webhook events (Phase 3)
  WEBHOOK_DELIVERED: 'Webhook.Delivered.v1',
  WEBHOOK_DELIVERY_FAILED: 'Webhook.DeliveryFailed.v1',
  WEBHOOK_DLQ: 'Webhook.DLQ.v1',

  // Notification events (Phase 3)
  NOTIFICATION_SENT: 'Notification.Sent.v1',
  NOTIFICATION_FAILED: 'Notification.Failed.v1',

  // Settlement events (Phase 4)
  SETTLEMENT_CREATED: 'Settlement.Created.v1',
  SETTLEMENT_PAID: 'Settlement.Paid.v1',
  HOLD_PLACED: 'Settlement.HoldPlaced.v1',
  HOLD_RELEASED: 'Settlement.HoldReleased.v1',

  // EOD events (Phase 4)
  DAY_CLOSED: 'Ledger.DayClosed.v1',
  RECONCILIATION_COMPLETED: 'Reconciliation.Completed.v1',
  RECONCILIATION_EXCEPTION: 'Reconciliation.Exception.v1',

  // Dispute events (Phase 4)
  CHARGEBACK_OPENED: 'Dispute.ChargebackOpened.v1',
  CHARGEBACK_RESOLVED: 'Dispute.ChargebackResolved.v1',
  DISPUTE_OPENED: 'Dispute.Opened.v1',
  DISPUTE_RESOLVED: 'Dispute.Resolved.v1',

  // Maker-checker events (Phase 4)
  APPROVAL_REQUESTED: 'Approval.Requested.v1',
  APPROVAL_DECIDED: 'Approval.Decided.v1',
  APPROVAL_EXECUTED: 'Approval.Executed.v1',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
