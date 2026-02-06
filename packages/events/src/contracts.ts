import { OwnerType, PostingLine } from '@caricash/common';

/**
 * Event contracts: immutable, versioned payload schemas.
 */

export interface LedgerPostedPayload {
  entryId: string;
  entryNumber: number;
  subledger: OwnerType;
  description: string;
  businessDay: string;
  idempotencyKey: string;
  lines: PostingLine[];
  metadata: Record<string, unknown>;
}

export interface LedgerReversedPayload {
  reversalEntryId: string;
  originalEntryId: string;
  subledger: OwnerType;
  description: string;
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
