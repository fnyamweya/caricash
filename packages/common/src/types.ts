export type OwnerType = 'CUSTOMER' | 'AGENT' | 'MERCHANT' | 'SYSTEM';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type EntryStatus = 'POSTED' | 'REVERSED';
export type DebitCredit = 'DEBIT' | 'CREDIT';
export type PrincipalType = 'CUSTOMER' | 'AGENT' | 'STAFF';
export type PrincipalKind = 'CUSTOMER' | 'MERCHANT' | 'AGENT' | 'STAFF';
export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REVOKED';
export type RoleScope = 'CUSTOMER' | 'MERCHANT' | 'AGENT' | 'STAFF' | 'SYSTEM';
export type StoreStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type AgentStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type KycRequirementStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';
export type KycProfileStatus = 'NOT_SUBMITTED' | 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type KycReviewStatus = 'OPEN' | 'ASSIGNED' | 'DECIDED' | 'CLOSED';
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type PrincipalStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'CLOSED';
export type AuditActorType = 'CUSTOMER' | 'AGENT' | 'STAFF' | 'SYSTEM';

// Phase 3 types
export type PaymentStatus = 'INITIATED' | 'AUTHORIZED' | 'LEDGER_POSTED' | 'NOTIFIED' | 'COMPLETED' | 'FAILED';
export type PaymentType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT' | 'REFUND' | 'REVERSAL';
export type PricingComponentType = 'FEE' | 'COMMISSION' | 'TAX' | 'DISCOUNT';
export type PricingCalcType = 'FLAT' | 'PERCENTAGE' | 'TIERED';
export type PricingRuleMatchMode = 'FIRST' | 'ACCUMULATE';
export type WebhookStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DLQ';
export type NotificationChannel = 'SMS' | 'PUSH' | 'EMAIL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DLQ';

// Phase 4 types
export type SettlementStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
export type MerchantHoldStatus = 'ACTIVE' | 'RELEASED' | 'FORFEITED';
export type DisputeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED_MERCHANT' | 'RESOLVED_CUSTOMER' | 'CLOSED';
export type ChargebackStatus = 'OPENED' | 'SUBMITTED' | 'WON' | 'LOST' | 'REVERSED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'CANCELLED';
export type ApprovalActionType =
  | 'PRICING_CHANGE' | 'COS_CHANGE' | 'SETTLEMENT_BANK_CHANGE'
  | 'MANUAL_FLOAT_ADJUSTMENT' | 'REVERSAL_OVERRIDE' | 'WEBHOOK_REPLAY'
  | 'AGENT_HIERARCHY_CHANGE';
export type CosMatchMode = 'FIRST' | 'ACCUMULATE';
export type CosOutputType = 'MEMO' | 'LEDGER_POSTING';
export type ReconciliationStatus = 'PENDING' | 'MATCHED' | 'PARTIAL_MATCH' | 'UNMATCHED' | 'EXCEPTION';

export interface PostingLine {
  accountId: string;
  debitCredit: DebitCredit;
  amount: string;         // string for precise decimal handling
  currencyCode: string;
}

export interface PostingRequest {
  idempotencyKey: string;
  subledger: OwnerType;
  description: string;
  reference: string;
  correlationId: string;
  businessDay: string;    // YYYY-MM-DD
  lines: PostingLine[];
  metadata?: Record<string, unknown>;
}

export interface JournalEntry {
  id: string;
  entryNumber: number;
  subledger: OwnerType;
  description: string;
  reference: string;
  correlationId: string;
  idempotencyKey: string;
  businessDay: string;
  status: EntryStatus;
  reversedEntryId?: string;
  metadata: Record<string, unknown>;
  entryHash: string;
  createdAt: Date;
}

export interface JournalLine {
  id: string;
  entryId: string;
  accountId: string;
  debitCredit: DebitCredit;
  amount: string;
  currencyCode: string;
  lineNumber: number;
  createdAt: Date;
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================================
// Phase 3: Payment types
// ============================================================

export interface Payment {
  id: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  idempotencyKey: string;
  correlationId: string;
  payerAccountId?: string;
  payeeAccountId?: string;
  payerPrincipalId?: string;
  payeePrincipalId?: string;
  amount: string;
  currencyCode: string;
  feeAmount: string;
  commissionAmount: string;
  totalAmount: string;
  journalEntryId?: string;
  pricingQuoteId?: string;
  reference?: string;
  description?: string;
  businessDay: string;
  failureReason?: string;
  failureCode?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEvent {
  id: string;
  paymentId: string;
  fromStatus?: PaymentStatus;
  toStatus: PaymentStatus;
  correlationId: string;
  actorType: AuditActorType;
  actorId?: string;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Phase 3: Pricing types
// ============================================================

export interface PricingRule {
  id: string;
  name: string;
  description?: string;
  paymentType: PaymentType;
  componentType: PricingComponentType;
  matchMode: PricingRuleMatchMode;
  countryCode?: string;
  productCode?: string;
  entityId?: string;
  calcType: PricingCalcType;
  flatAmount?: string;
  percentageRate?: string;
  tierConfig?: PricingTier[];
  minAmount?: string;
  maxAmount?: string;
  currencyCode?: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface PricingTier {
  min: string;
  max: string;
  flat?: string;
  rate?: string;
}

export interface PricingQuote {
  id: string;
  paymentId?: string;
  paymentType: PaymentType;
  principalAmount: string;
  currencyCode: string;
  totalFees: string;
  totalCommission: string;
  totalAmount: string;
  ruleTrace: PricingRuleTraceEntry[];
  countryCode?: string;
  entityId?: string;
  createdAt: Date;
}

export interface PricingRuleTraceEntry {
  ruleId: string;
  ruleName: string;
  componentType: PricingComponentType;
  calcType: PricingCalcType;
  inputAmount: string;
  outputAmount: string;
  priority: number;
}

// ============================================================
// Phase 3: Webhook types
// ============================================================

export interface WebhookSubscription {
  id: string;
  principalId: string;
  url: string;
  status: WebhookStatus;
  eventTypes: string[];
  signingKeyId: string;
  maxRetries: number;
  timeoutMs: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  correlationId: string;
  status: WebhookDeliveryStatus;
  payload: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  dlqAt?: Date;
  createdAt: Date;
}

// ============================================================
// Phase 4: Settlement types
// ============================================================

export interface Settlement {
  id: string;
  principalId: string;
  storeId?: string;
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  grossAmount: string;
  feeAmount: string;
  holdAmount: string;
  netAmount: string;
  status: SettlementStatus;
  journalEntryId?: string;
  paidAt?: Date;
  bankReference?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Phase 4: Dispute types
// ============================================================

export interface Dispute {
  id: string;
  paymentId: string;
  storeId?: string;
  principalId: string;
  status: DisputeStatus;
  reason: string;
  amount: string;
  currencyCode: string;
  holdId?: string;
  resolution?: string;
  journalEntryId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Phase 4: Maker-checker types
// ============================================================

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  status: ApprovalStatus;
  idempotencyKey: string;
  correlationId: string;
  requestedBy: string;
  description: string;
  payload: Record<string, unknown>;
  resourceType: string;
  resourceId?: string;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================
// Phase 4: CoS rules engine types
// ============================================================

export interface CosRule {
  id: string;
  name: string;
  description?: string;
  matchMode: CosMatchMode;
  conditions: CosCondition[];
  outputType: CosOutputType;
  components: CosComponent[];
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export type CosOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'between';

export interface CosCondition {
  field: string;
  operator: CosOperator;
  value: string | number | string[] | [string, string];
}

export interface CosComponent {
  name: string;
  calcType: PricingCalcType;
  flat?: string;
  rate?: string;
  tiers?: PricingTier[];
  memo?: string;
}

export interface CosQuote {
  id: string;
  paymentId?: string;
  reconRunId?: string;
  totalCost: string;
  currencyCode: string;
  ruleTrace: CosRuleTraceEntry[];
  createdAt: Date;
}

export interface CosRuleTraceEntry {
  ruleId: string;
  ruleName: string;
  matchMode: CosMatchMode;
  conditionsMatched: boolean;
  components: CosComponentResult[];
}

export interface CosComponentResult {
  name: string;
  amount: string;
  memo?: string;
}
