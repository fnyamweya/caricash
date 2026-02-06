export type OwnerType = 'CUSTOMER' | 'AGENT' | 'MERCHANT' | 'SYSTEM';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type EntryStatus = 'POSTED' | 'REVERSED';
export type DebitCredit = 'DEBIT' | 'CREDIT';
export type PrincipalType = 'CUSTOMER' | 'AGENT' | 'STAFF';
export type PrincipalStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED' | 'CLOSED';
export type AuditActorType = 'CUSTOMER' | 'AGENT' | 'STAFF' | 'SYSTEM';

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
  correlationId: string;
  idempotencyKey: string;
  businessDay: string;
  status: EntryStatus;
  reversedEntryId?: string;
  metadata: Record<string, unknown>;
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
