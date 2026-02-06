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
