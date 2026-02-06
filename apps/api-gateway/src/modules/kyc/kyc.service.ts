import { Injectable } from '@nestjs/common';
import { KycRepository, KycDocumentRow } from './kyc.repository';
import { encryptPayload, hashPayload, decryptPayload } from '@caricash/crypto';
import { getCacheClient, resolveEffectiveRecord } from '@caricash/common';
import { EventTypes } from '@caricash/events';
import { query } from '@caricash/db';
import { ConflictError } from '@caricash/common';

@Injectable()
export class KycService {
  constructor(private readonly repo: KycRepository) {}

  static resolveRequirementSet<T extends { status: string; effective_from: string; version: number }>(requirementSets: T[], now: Date): T | null {
    const ordered = [...requirementSets].sort((a, b) => {
      const dateCompare = b.effective_from.localeCompare(a.effective_from);
      if (dateCompare !== 0) return dateCompare;
      return b.version - a.version;
    });
    return resolveEffectiveRecord(ordered, now) as T | null;
  }

  async getRequirements(params: { countryCode: string; userType: string; tier: string }) {
    const cache = await getCacheClient();
    const cacheKey = `kyc:req:${params.countryCode}:${params.userType}:${params.tier}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const requirementSets = await this.repo.listRequirementSets(params);
    const requirementSet = KycService.resolveRequirementSet(requirementSets, new Date());
    if (!requirementSet) {
      return null;
    }

    const [fields, documents] = await Promise.all([
      this.repo.listRequirementFields(requirementSet.id),
      this.repo.listRequirementDocuments(requirementSet.id),
    ]);

    const response = {
      requirementSet,
      fields,
      documents,
    };

    await cache.set(cacheKey, JSON.stringify(response), 300);
    return response;
  }

  async ensureProfile(params: { userId: string; countryCode: string; userType: string; tier: string }) {
    const existing = await this.repo.findProfile({ userId: params.userId, tier: params.tier });
    if (existing) return existing;
    const requirementSet = await this.repo.findActiveRequirementSet({
      countryCode: params.countryCode,
      userType: params.userType,
      tier: params.tier,
    });
    const profile = await this.repo.createProfile({
      countryCode: params.countryCode,
      userType: params.userType,
      userId: params.userId,
      tier: params.tier,
      requirementSetId: requirementSet?.id,
      versionApplied: requirementSet?.version,
    });
    if (!profile) {
      throw new ConflictError('Failed to create KYC profile');
    }
    return profile;
  }

  async submitKyc(params: {
    userId: string;
    countryCode: string;
    userType: string;
    tier: string;
    fields: Record<string, unknown>;
    documents: Array<{ docType: string; fileRef: string; fileHash: string; metadata?: Record<string, unknown> }>;
    correlationId?: string;
  }) {
    const requirement = await this.getRequirements({
      countryCode: params.countryCode,
      userType: params.userType,
      tier: params.tier,
    });
    const profile = await this.ensureProfile(params);

    const missing = this.getMissingFields(requirement?.fields ?? [], params.fields);
    const missingDocs = this.getMissingDocs(requirement?.documents ?? [], params.documents);

    const riskScore = this.computeRiskScore(params.fields, missing, missingDocs);
    const riskReason = missingDocs.length > 0 ? 'MISSING_DOCS' : 'STANDARD';

    const updated = await this.repo.updateProfile({
      profileId: profile.id,
      status: 'PENDING',
      requirementSetId: requirement?.requirementSet?.id,
      versionApplied: requirement?.requirementSet?.version,
      riskScore,
      riskReason,
    });
    if (!updated) {
      throw new ConflictError('Failed to update KYC profile');
    }

    for (const [fieldKey, value] of Object.entries(params.fields)) {
      const encrypted = encryptPayload(value);
      const metadataHash = hashPayload({ fieldKey, value });
      await this.repo.upsertProfileData({ profileId: profile.id, fieldKey, valueEncrypted: encrypted, metadataHash });
    }

    for (const doc of params.documents) {
      const metadata = doc.metadata ?? {};
      const metadataHash = hashPayload({ docType: doc.docType, fileRef: doc.fileRef, fileHash: doc.fileHash, metadata });
      const metadataEncrypted = encryptPayload(metadata);
      await this.repo.insertDocument({
        profileId: profile.id,
        docType: doc.docType,
        fileRef: doc.fileRef,
        fileHash: doc.fileHash,
        metadataHash,
        metadataEncrypted,
      });
    }

    const queue = riskScore >= 70 ? 'HIGH_RISK' : 'STANDARD';
    const review = await this.repo.createReview({ profileId: profile.id, queue });
    if (!review) {
      throw new ConflictError('Failed to create KYC review');
    }

    await query(
      `INSERT INTO outbox_events (event_type, correlation_id, payload)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [
        EventTypes.KYC_SUBMITTED,
        params.correlationId ?? null,
        JSON.stringify({
          profileId: profile.id,
          userId: params.userId,
          countryCode: params.countryCode,
          tier: params.tier,
          riskScore,
        }),
        EventTypes.KYC_REVIEW_ASSIGNED,
        params.correlationId ?? null,
        JSON.stringify({
          reviewId: review.id,
          profileId: profile.id,
          queue,
        }),
      ],
    );

    return {
      profileId: profile.id,
      status: 'PENDING',
      riskScore,
      queue,
      missing,
      missingDocs,
    };
  }

  async getStatus(params: { userId: string; tier: string }) {
    const profile = await this.repo.findProfile({ userId: params.userId, tier: params.tier });
    if (!profile) {
      return { status: 'NOT_SUBMITTED' };
    }
    const requirement = await this.getRequirements({
      countryCode: profile.country_code,
      userType: profile.user_type,
      tier: profile.tier,
    });
    const data = await this.repo.listProfileData(profile.id);
    const docs = await this.repo.listDocuments(profile.id);
    const missing = this.getMissingFields(requirement?.fields ?? [], Object.fromEntries(data.map((d) => [d.field_key, true])));
    const missingDocs = this.getMissingDocs(requirement?.documents ?? [], docs.map((d) => ({ docType: d.doc_type, fileRef: d.file_ref, fileHash: d.file_hash })));
    const integrity = docs.map((doc) => this.verifyDocumentIntegrity(doc));

    return {
      profileId: profile.id,
      status: profile.status,
      riskScore: profile.risk_score,
      missing,
      missingDocs,
      integrity,
    };
  }

  async explain(params: { userId: string; tier: string }) {
    const profile = await this.repo.findProfile({ userId: params.userId, tier: params.tier });
    if (!profile) {
      return { reason: 'PROFILE_MISSING', missing: [], missingDocs: [] };
    }
    const requirement = await this.getRequirements({
      countryCode: profile.country_code,
      userType: profile.user_type,
      tier: profile.tier,
    });
    const data = await this.repo.listProfileData(profile.id);
    const docs = await this.repo.listDocuments(profile.id);
    const missing = this.getMissingFields(requirement?.fields ?? [], Object.fromEntries(data.map((d) => [d.field_key, true])));
    const missingDocs = this.getMissingDocs(requirement?.documents ?? [], docs.map((d) => ({ docType: d.doc_type, fileRef: d.file_ref, fileHash: d.file_hash })));
    return { reason: missing.length || missingDocs.length ? 'REQUIREMENTS_MISSING' : 'COMPLETE', missing, missingDocs };
  }

  getMissingFields(requirements: Array<{ field_key: string; required: boolean }>, fields: Record<string, unknown>) {
    return requirements
      .filter((req) => req.required)
      .map((req) => req.field_key)
      .filter((key) => fields[key] === undefined || fields[key] === null);
  }

  getMissingDocs(requirements: Array<{ doc_type: string; required: boolean; min_count: number }>, docs: Array<{ docType: string }>) {
    return requirements
      .filter((req) => req.required)
      .filter((req) => docs.filter((doc) => doc.docType === req.doc_type).length < req.min_count)
      .map((req) => req.doc_type);
  }

  computeRiskScore(fields: Record<string, unknown>, missingFields: string[], missingDocs: string[]) {
    let score = 0;
    if (missingFields.length > 0) score += 20;
    if (missingDocs.length > 0) score += 40;
    const dob = fields['dob'] ?? fields['date_of_birth'];
    if (typeof dob === 'string') {
      const age = this.calculateAge(dob);
      if (age !== null && age < 18) score += 40;
    }
    return Math.min(score, 100);
  }

  private calculateAge(dob: string): number | null {
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }

  private verifyDocumentIntegrity(doc: KycDocumentRow) {
    const encrypted = doc.metadata_encrypted as { ciphertext?: string; iv?: string; tag?: string; keyId?: string } | undefined;
    const metadata = encrypted?.ciphertext ? (decryptPayload(encrypted as { ciphertext: string; iv: string; tag: string; keyId: string }) as Record<string, unknown>) : {};
    const expectedHash = hashPayload({
      docType: doc.doc_type,
      fileRef: doc.file_ref,
      fileHash: doc.file_hash,
      metadata,
    });
    return { docType: doc.doc_type, ok: expectedHash === doc.metadata_hash };
  }
}
