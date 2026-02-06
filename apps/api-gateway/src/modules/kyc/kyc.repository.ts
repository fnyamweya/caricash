import { Injectable } from '@nestjs/common';
import { queryOne, queryMany } from '@caricash/db';

export interface RequirementSetRow {
  id: string;
  country_code: string;
  user_type: string;
  tier: string;
  version: number;
  status: string;
  effective_from: string;
}

export interface RequirementFieldRow {
  id: string;
  requirement_set_id: string;
  field_key: string;
  field_type: string;
  required: boolean;
  rules_json: unknown;
  source: string;
}

export interface RequirementDocumentRow {
  id: string;
  requirement_set_id: string;
  doc_type: string;
  required: boolean;
  min_count: number;
  rules_json: unknown;
}

export interface KycProfileRow {
  id: string;
  country_code: string;
  user_type: string;
  user_id: string;
  tier: string;
  status: string;
  requirement_set_id?: string | null;
  version_applied?: number | null;
  risk_score: number;
  risk_reason?: string | null;
}

export interface KycProfileDataRow {
  id: string;
  profile_id: string;
  field_key: string;
  value_encrypted: unknown;
  metadata_hash: string;
}

export interface KycDocumentRow {
  id: string;
  profile_id: string;
  doc_type: string;
  file_ref: string;
  file_hash: string;
  metadata_hash: string;
  metadata_encrypted?: unknown;
}

export interface KycReviewRow {
  id: string;
  profile_id: string;
  queue: string;
  status: string;
  assigned_to?: string | null;
}

@Injectable()
export class KycRepository {
  async findActiveRequirementSet(params: { countryCode: string; userType: string; tier: string }): Promise<RequirementSetRow | null> {
    return queryOne<RequirementSetRow>(
      `SELECT * FROM kyc_requirement_sets
       WHERE country_code = $1 AND user_type = $2 AND tier = $3 AND status = 'ACTIVE' AND effective_from <= CURRENT_DATE
       ORDER BY effective_from DESC, version DESC
       LIMIT 1`,
      [params.countryCode, params.userType, params.tier],
    );
  }

  async listRequirementSets(params: { countryCode: string; userType: string; tier: string }): Promise<RequirementSetRow[]> {
    return queryMany<RequirementSetRow>(
      `SELECT * FROM kyc_requirement_sets
       WHERE country_code = $1 AND user_type = $2 AND tier = $3
       ORDER BY effective_from DESC, version DESC`,
      [params.countryCode, params.userType, params.tier],
    );
  }

  async listRequirementFields(requirementSetId: string): Promise<RequirementFieldRow[]> {
    return queryMany<RequirementFieldRow>(
      `SELECT * FROM kyc_requirement_fields WHERE requirement_set_id = $1 ORDER BY field_key`,
      [requirementSetId],
    );
  }

  async listRequirementDocuments(requirementSetId: string): Promise<RequirementDocumentRow[]> {
    return queryMany<RequirementDocumentRow>(
      `SELECT * FROM kyc_requirement_documents WHERE requirement_set_id = $1 ORDER BY doc_type`,
      [requirementSetId],
    );
  }

  async findProfile(params: { userId: string; tier: string }): Promise<KycProfileRow | null> {
    return queryOne<KycProfileRow>(
      'SELECT * FROM kyc_profiles WHERE user_id = $1 AND tier = $2',
      [params.userId, params.tier],
    );
  }

  async createProfile(params: { countryCode: string; userType: string; userId: string; tier: string; requirementSetId?: string; versionApplied?: number }): Promise<KycProfileRow | null> {
    return queryOne<KycProfileRow>(
      `INSERT INTO kyc_profiles (country_code, user_type, user_id, tier, requirement_set_id, version_applied)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [params.countryCode, params.userType, params.userId, params.tier, params.requirementSetId ?? null, params.versionApplied ?? null],
    );
  }

  async updateProfile(params: { profileId: string; status: string; requirementSetId?: string; versionApplied?: number; riskScore?: number; riskReason?: string }): Promise<KycProfileRow | null> {
    return queryOne<KycProfileRow>(
      `UPDATE kyc_profiles
       SET status = $1,
           requirement_set_id = COALESCE($2, requirement_set_id),
           version_applied = COALESCE($3, version_applied),
           risk_score = COALESCE($4, risk_score),
           risk_reason = COALESCE($5, risk_reason),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [params.status, params.requirementSetId ?? null, params.versionApplied ?? null, params.riskScore ?? null, params.riskReason ?? null, params.profileId],
    );
  }

  async upsertProfileData(params: { profileId: string; fieldKey: string; valueEncrypted: unknown; metadataHash: string }): Promise<KycProfileDataRow | null> {
    return queryOne<KycProfileDataRow>(
      `INSERT INTO kyc_profile_data (profile_id, field_key, value_encrypted, metadata_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, field_key) DO UPDATE SET value_encrypted = $3, metadata_hash = $4
       RETURNING *`,
      [params.profileId, params.fieldKey, JSON.stringify(params.valueEncrypted), params.metadataHash],
    );
  }

  async insertDocument(params: { profileId: string; docType: string; fileRef: string; fileHash: string; metadataHash: string; metadataEncrypted?: unknown }): Promise<KycDocumentRow | null> {
    return queryOne<KycDocumentRow>(
      `INSERT INTO kyc_documents (profile_id, doc_type, file_ref, file_hash, metadata_hash, metadata_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.profileId,
        params.docType,
        params.fileRef,
        params.fileHash,
        params.metadataHash,
        JSON.stringify(params.metadataEncrypted ?? {}),
      ],
    );
  }

  async createReview(params: { profileId: string; queue: string; assignedTo?: string }): Promise<KycReviewRow | null> {
    return queryOne<KycReviewRow>(
      `INSERT INTO kyc_reviews (profile_id, queue, status, assigned_to)
       VALUES ($1, $2, 'ASSIGNED', $3)
       RETURNING *`,
      [params.profileId, params.queue, params.assignedTo ?? null],
    );
  }

  async listProfileData(profileId: string): Promise<KycProfileDataRow[]> {
    return queryMany<KycProfileDataRow>('SELECT * FROM kyc_profile_data WHERE profile_id = $1', [profileId]);
  }

  async listDocuments(profileId: string): Promise<KycDocumentRow[]> {
    return queryMany<KycDocumentRow>('SELECT * FROM kyc_documents WHERE profile_id = $1', [profileId]);
  }
}
