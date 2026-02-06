import { OwnerType, PostingLine } from '@caricash/common';

/**
 * Event contracts: immutable, versioned payload schemas.
 */

export interface LedgerPostedPayload {
  entryId: string;
  entryNumber: number;
  subledger: OwnerType;
  description: string;
  reference: string;
  businessDay: string;
  idempotencyKey: string;
  lines: PostingLine[];
  metadata: Record<string, unknown>;
  entryHash: string;
}

export interface LedgerReversedPayload {
  reversalEntryId: string;
  originalEntryId: string;
  subledger: OwnerType;
  description: string;
  reference: string;
  businessDay: string;
  lines: PostingLine[];
}

export interface AuditRecordedPayload {
  auditEventId: string;
  sequenceNumber: number;
  actorType: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  hash: string;
}

export interface PrincipalCreatedPayload {
  principalId: string;
  principalType: string;
  displayName: string;
}

export interface KycRequirementsPublishedPayload {
  requirementSetId: string;
  countryCode: string;
  userType: string;
  tier: string;
  version: number;
}

export interface KycSubmittedPayload {
  profileId: string;
  userId: string;
  countryCode: string;
  tier: string;
  riskScore: number;
}

export interface KycReviewAssignedPayload {
  reviewId: string;
  profileId: string;
  assignedTo?: string;
  queue: string;
}

export interface KycApprovedPayload {
  profileId: string;
  userId: string;
  tier: string;
  countryCode: string;
}

export interface KycRejectedPayload {
  profileId: string;
  userId: string;
  tier: string;
  countryCode: string;
  reason?: string;
}

export interface KycTierUpgradedPayload {
  profileId: string;
  userId: string;
  previousTier: string;
  newTier: string;
}

export interface StoreCreatedPayload {
  storeId: string;
  principalId: string;
  storeNumber: string;
  countryCode: string;
}

export interface AgentCreatedPayload {
  agentId: string;
  principalId: string;
  agentNumber: string;
  level: number;
  parentAgentId?: string | null;
  countryCode: string;
}

export interface AgentUpdatedPayload {
  agentId: string;
  status?: string;
  parentAgentId?: string | null;
  level?: number;
}

// ============================================================
// Phase 3: Payment Events
// ============================================================

export interface PaymentInitiatedPayload {
  paymentId: string;
  paymentType: string;
  amount: string;
  currencyCode: string;
  payerAccountId?: string;
  payeeAccountId?: string;
  idempotencyKey: string;
  correlationId: string;
  businessDay: string;
}

export interface PaymentAuthorizedPayload {
  paymentId: string;
  correlationId: string;
  authorizedBy?: string;
}

export interface PaymentLedgerPostedPayload {
  paymentId: string;
  journalEntryId: string;
  correlationId: string;
  feeAmount: string;
  commissionAmount: string;
  totalAmount: string;
}

export interface PaymentNotifiedPayload {
  paymentId: string;
  correlationId: string;
  notificationJobIds: string[];
}

export interface PaymentCompletedPayload {
  paymentId: string;
  correlationId: string;
  totalAmount: string;
  currencyCode: string;
}

export interface PaymentFailedPayload {
  paymentId: string;
  correlationId: string;
  failureCode: string;
  failureReason: string;
  fromStatus: string;
}

// ============================================================
// Phase 3: Pricing Events
// ============================================================

export interface PricingQuoteCreatedPayload {
  quoteId: string;
  paymentId?: string;
  paymentType: string;
  principalAmount: string;
  totalFees: string;
  totalCommission: string;
  totalAmount: string;
  currencyCode: string;
  ruleTrace: PricingRuleTraceItem[];
}

export interface PricingRuleTraceItem {
  ruleId: string;
  ruleName: string;
  componentType: string;
  calcType: string;
  inputAmount: string;
  outputAmount: string;
  priority: number;
}

// ============================================================
// Phase 3: Webhook Events
// ============================================================

export interface WebhookDeliveredPayload {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  httpStatus: number;
  attemptNumber: number;
}

export interface WebhookDeliveryFailedPayload {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  attemptNumber: number;
  errorMessage: string;
  nextRetryAt?: string;
}

export interface WebhookDLQPayload {
  deliveryId: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  totalAttempts: number;
  lastError: string;
}

// ============================================================
// Phase 3: Notification Events
// ============================================================

export interface NotificationSentPayload {
  jobId: string;
  channel: string;
  recipient: string;
  templateCode: string;
  correlationId: string;
}

export interface NotificationFailedPayload {
  jobId: string;
  channel: string;
  recipient: string;
  errorMessage: string;
  correlationId: string;
}

// ============================================================
// Phase 4: Settlement Events
// ============================================================

export interface SettlementCreatedPayload {
  settlementId: string;
  principalId: string;
  storeId?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  currencyCode: string;
}

export interface SettlementPaidPayload {
  settlementId: string;
  principalId: string;
  netAmount: string;
  currencyCode: string;
  bankReference?: string;
  journalEntryId: string;
}

export interface HoldPlacedPayload {
  holdId: string;
  principalId: string;
  disputeId?: string;
  amount: string;
  currencyCode: string;
  reason: string;
}

export interface HoldReleasedPayload {
  holdId: string;
  principalId: string;
  amount: string;
  currencyCode: string;
  releasedBy: string;
}

// ============================================================
// Phase 4: EOD / Reconciliation Events
// ============================================================

export interface DayClosedPayload {
  businessDay: string;
  closedBy?: string;
  reportHash: string;
  entryCount: number;
  totalDebits: string;
  totalCredits: string;
}

export interface ReconciliationCompletedPayload {
  runId: string;
  runType: string;
  businessDay: string;
  totalItems: number;
  matchedItems: number;
  unmatchedItems: number;
  exceptionItems: number;
}

export interface ReconciliationExceptionPayload {
  exceptionId: string;
  runId: string;
  exceptionType: string;
  description: string;
  amount?: string;
  currencyCode?: string;
}

// ============================================================
// Phase 4: Dispute Events
// ============================================================

export interface ChargebackOpenedPayload {
  chargebackId: string;
  disputeId: string;
  paymentId: string;
  amount: string;
  currencyCode: string;
  reasonCode?: string;
}

export interface ChargebackResolvedPayload {
  chargebackId: string;
  disputeId: string;
  paymentId: string;
  status: string;
  journalEntryId?: string;
}

export interface DisputeOpenedPayload {
  disputeId: string;
  paymentId: string;
  principalId: string;
  amount: string;
  currencyCode: string;
  reason: string;
  holdId?: string;
}

export interface DisputeResolvedPayload {
  disputeId: string;
  paymentId: string;
  principalId: string;
  status: string;
  resolution?: string;
  journalEntryId?: string;
}

// ============================================================
// Phase 4: Maker-Checker Events
// ============================================================

export interface ApprovalRequestedPayload {
  requestId: string;
  actionType: string;
  requestedBy: string;
  description: string;
  resourceType: string;
  resourceId?: string;
  correlationId: string;
}

export interface ApprovalDecidedPayload {
  requestId: string;
  decisionId: string;
  decidedBy: string;
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface ApprovalExecutedPayload {
  requestId: string;
  executionId: string;
  decisionId: string;
  result: Record<string, unknown>;
}
