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
export interface PostingLine {
    accountId: string;
    debitCredit: DebitCredit;
    amount: string;
    currencyCode: string;
}
export interface PostingRequest {
    idempotencyKey: string;
    subledger: OwnerType;
    description: string;
    reference: string;
    correlationId: string;
    businessDay: string;
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
//# sourceMappingURL=types.d.ts.map