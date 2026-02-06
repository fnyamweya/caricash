# Phase 2 Blueprint: Identity, KYC, Merchant/Agent Access, Config & Governance

## Repo Blueprint (Modules + File Tree)
```
apps/api-gateway/src/modules
├── agent-access
├── audit
├── customers
├── idempotency
├── iam
├── identity
├── kyc
├── ledger
├── merchant-access
├── policy
├── security
├── stores

apps/admin-api/src/modules
├── agents
├── audit
├── config
├── health

packages
├── common (abac/config/cache helpers)
├── crypto (ledger hash + envelope encryption)
├── events (KYC + agent events)
├── observability (PII redaction + leak detector)
├── policy (obligations + regression suite)
```

## Database DDL & Migration Plan
**Migration:** `migrations/002_phase2.up.sql`
- **New enums:** `principal_kind`, `membership_status`, `role_scope`, `store_status`, `agent_status`, `kyc_requirement_status`, `kyc_profile_status`, `kyc_review_status`, `kyc_verification_status`.
- **Users/principals/memberships:** `users` table (renamed), `principals`, `memberships` with ABAC whitelist validation.
- **Roles/permissions:** `permissions`, `role_permissions`, `role_bindings`; roles now scoped.
- **Merchants:** `stores`, `tills`, `membership_tills`.
- **Agents:** `agents` with hierarchy constraints (max depth 3).
- **KYC:** `kyc_requirement_sets`, `kyc_requirement_fields`, `kyc_requirement_documents`, `kyc_profiles`, `kyc_profile_data`, `kyc_documents`, `kyc_reviews`.
- **Config core:** `permission_catalogs`, `policy_bundles`.
- **Ledger guardrails:** `journal_entries.reference`, `journal_entries.entry_hash`, immutability triggers, `ledger_post_entry()` stored procedure.

**Plan:**
1. Apply `001_foundation.up.sql`.
2. Apply `002_phase2.up.sql` (adds Phase 2 schema and guardrails).
3. Use `node packages/db/dist/migrate.js migrations/` to execute migrations.

## API Contracts (v1)
### Public (API Gateway)
- `POST /api/v1/customers` (signup)
- `GET /api/v1/customers/me`
- `GET /api/v1/kyc/requirements?country&user_type&tier`
- `POST /api/v1/kyc/customers/submit`
- `GET /api/v1/kyc/status?tier`
- `GET /api/v1/kyc/explain?tier`
- `POST /api/v1/stores`
- `GET /api/v1/stores/me`
- `GET /api/v1/stores/me/tills`

### Merchant Access (API Gateway)
- `GET /api/v1/merchant/access/users`
- `POST /api/v1/merchant/access/users`
- `PATCH /api/v1/merchant/access/users/:id/attributes`
- `PATCH /api/v1/merchant/access/users/:id/role`
- `PATCH /api/v1/merchant/access/users/:id/tills`
- `GET /api/v1/merchant/access/roles`
- `POST /api/v1/merchant/access/roles`
- `POST /api/v1/merchant/access/simulate`

### Agent Access (API Gateway)
- `GET /api/v1/agent/access/users`
- `POST /api/v1/agent/access/users`
- `PATCH /api/v1/agent/access/users/:id/attributes`
- `PATCH /api/v1/agent/access/users/:id/role`
- `GET /api/v1/agent/access/roles`
- `POST /api/v1/agent/access/roles`
- `POST /api/v1/agent/access/simulate`

### Admin (Admin API)
- `POST /api/v1/admin/agents`
- `PATCH /api/v1/admin/agents/:id`
- `GET /api/v1/admin/agents?country&status`
- `GET /api/v1/config/kyc-requirements?country&user_type&tier`
- `GET /api/v1/config/permission-catalogs?country`
- `GET /api/v1/config/policy-bundles?country`

## Event Contracts (Outbox)
- `Ledger.Posted.v1` (entry_id, entry_hash, receipt)
- `Ledger.Reversed.v1`
- `Audit.Recorded.v1`
- `Identity.PrincipalCreated.v1`
- `Kyc.RequirementsPublished.v1`
- `Kyc.Submitted.v1`
- `Kyc.ReviewAssigned.v1`
- `Kyc.Approved.v1`
- `Kyc.Rejected.v1`
- `Kyc.TierUpgraded.v1`
- `Merchant.StoreCreated.v1`
- `Agent.Created.v1`
- `Agent.Updated.v1`

## Workflows
### Customer Signup → KYC → Tier Upgrade
1. `POST /customers` creates user + principal + membership (role CUSTOMER_SELF), creates KYC profile.
2. `POST /kyc/customers/submit` stores encrypted fields + doc hashes; creates review case.
3. KYC review (manual) updates profile status and emits KycApproved/KycRejected events.
4. Tier upgrades issued by staff in future release (Phase 3/4) with obligations.

### Merchant Signup → Tills → Access
1. `POST /stores` creates merchant principal, store, tills, and owner membership.
2. Access endpoints manage memberships, attributes, and till bindings.
3. Policy engine enforces principal boundary (store scoped).

### Agent Onboarding → Hierarchy → Members
1. `POST /admin/agents` creates agent principal + agent record, enforces max depth/no cycles.
2. `PATCH /admin/agents/:id` updates status/parent/level with validations.
3. Agent access endpoints manage membership roles and attributes.

## Policy Library
- **Default roles:** CUSTOMER_SELF, MERCHANT_OWNER/MANAGER/CASHIER/VIEWER, AGENT_OWNER/SUPERVISOR/TELLER/VIEWER, STAFF_COMPLIANCE/FINANCE/OPS/SUPPORT.
- **Permission catalog:** ledger.post, ledger.read, kyc.submit, kyc.review, merchant.user.manage, merchant.role.manage, agent.user.manage, agent.role.manage.
- **ABAC whitelist:** max_*_amount, daily_limit, refund_minutes, allowed_* scopes, device_binding.
- **Policy packs:** `policies/phase2.yaml` and `policies/regression-suite.json` (200+ checks).

## Stop-the-Line Checklist (Security/Compliance)
- KYC decisions MUST be audited.
- Access control changes MUST be audited and policy-checked.
- Raw KYC docs MUST NOT be stored in DB.
- PII MUST NOT appear in logs, audit payloads, or webhooks.
- Agent hierarchy MUST NOT allow cycles or depth > 3.
- Policy engine MUST be enforced for merchant/agent access endpoints.
- Idempotency keys MUST be enforced for signup and KYC submit.

## Testing & CI
- **Unit:** KYC requirement resolution, policy evaluation, hierarchy validation.
- **Integration:** customer signup, merchant membership, agent onboarding validations.
- **Contract:** KYC requirements/submit/status shape checks.
- **Property:** random hierarchy attempts cannot exceed depth or cycle.
- **Security:** rate limits, lockouts, PII leak detection.

**Run tests:** `pnpm test` (or targeted `pnpm --filter @caricash/api-gateway test`).

## PII Governance & Retention
- PII stored encrypted via AES-256-GCM (envelope encryption placeholder).
- KYC profile data/doc metadata stored encrypted; document file refs + hashes only.
- Audit payloads are redacted (`@caricash/observability`).
- Retention policy placeholders stored in config (Phase 4 enforcement).

## UI Scaffolding Plan
- KYC Queue List
- KYC Case Detail
- Merchant Users & Roles
- Agent Users & Roles
- Policy Simulator

## Threat Model (Top 10)
1. **Unauthorized access** → RBAC/ABAC + principal boundary checks.
2. **Privilege escalation** → policy obligations enforced + audit trail.
3. **PII leaks** → redaction + encryption.
4. **Ledger tampering** → immutable triggers + hash receipts.
5. **Replay attacks** → idempotency keys.
6. **Rate limit abuse** → Redis throttling.
7. **KYC fraud** → hash integrity + review queues.
8. **Hierarchy abuse** → depth/cycle validation.
9. **Config drift** → effective-dated config resolution.
10. **Event loss** → outbox + inbox dedup.

## Definition of Done (Phase 2)
- All required endpoints implemented and policy-checked.
- KYC requirements/config resolution in place.
- Ledger guardrails + receipts enabled.
- PII encryption + redaction validated.
- Tests green (unit/integration/contract/property/security).
- Admin UI scaffolding merged.
