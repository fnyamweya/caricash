-- Migration 002: Phase 2 Identity, KYC, Merchants, Agents, Config, Ledger Guardrails

-- ============================================================
-- IDENTITY: Rename principals -> users
-- ============================================================
ALTER TABLE principals RENAME TO users;
ALTER INDEX idx_principals_external_id RENAME TO idx_users_external_id;
ALTER INDEX idx_principals_type_status RENAME TO idx_users_type_status;
ALTER INDEX idx_principals_phone RENAME TO idx_users_phone;
ALTER INDEX idx_principals_email RENAME TO idx_users_email;

ALTER TABLE users ADD COLUMN country_code CHAR(2) REFERENCES countries(code);
ALTER TABLE users ADD COLUMN msisdn VARCHAR(50);
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

UPDATE users SET msisdn = phone WHERE msisdn IS NULL AND phone IS NOT NULL;

CREATE UNIQUE INDEX idx_users_msisdn_country ON users(country_code, msisdn) WHERE msisdn IS NOT NULL;

-- Update refresh_tokens FK
ALTER TABLE refresh_tokens RENAME COLUMN principal_id TO user_id;
ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_principal_id_fkey;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- Update principal_roles -> user_roles
ALTER TABLE principal_roles RENAME TO user_roles;
ALTER TABLE user_roles RENAME COLUMN principal_id TO user_id;
ALTER TABLE user_roles DROP CONSTRAINT principal_roles_principal_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT principal_roles_role_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);

-- ============================================================
-- ENUMS: Phase 2
-- ============================================================
CREATE TYPE principal_kind AS ENUM ('CUSTOMER', 'MERCHANT', 'AGENT', 'STAFF');
CREATE TYPE membership_status AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'REVOKED');
CREATE TYPE role_scope AS ENUM ('CUSTOMER', 'MERCHANT', 'AGENT', 'STAFF', 'SYSTEM');
CREATE TYPE store_status AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE agent_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE kyc_requirement_status AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE kyc_profile_status AS ENUM ('NOT_SUBMITTED', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE kyc_review_status AS ENUM ('OPEN', 'ASSIGNED', 'DECIDED', 'CLOSED');
CREATE TYPE kyc_verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- ============================================================
-- IDENTITY: Business Principals + Memberships
-- ============================================================
CREATE TABLE principals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_type  principal_kind NOT NULL,
  status          principal_status NOT NULL DEFAULT 'ACTIVE',
  country_code    CHAR(2) NOT NULL REFERENCES countries(code),
  display_name    VARCHAR(255) NOT NULL,
  external_ref    VARCHAR(255),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_principals_type_status ON principals(principal_type, status);
CREATE INDEX idx_principals_country ON principals(country_code);
CREATE UNIQUE INDEX idx_principals_external_ref ON principals(external_ref) WHERE external_ref IS NOT NULL;

CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  principal_id    UUID NOT NULL REFERENCES principals(id),
  role_id         UUID NOT NULL REFERENCES roles(id),
  status          membership_status NOT NULL DEFAULT 'ACTIVE',
  member_attributes JSONB NOT NULL DEFAULT '{}',
  device_binding_required BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_membership_user_principal UNIQUE (user_id, principal_id)
);

CREATE INDEX idx_memberships_principal ON memberships(principal_id, status);
CREATE INDEX idx_memberships_user ON memberships(user_id, status);

-- Whitelist validation for member_attributes
CREATE OR REPLACE FUNCTION validate_member_attributes(attrs JSONB) RETURNS BOOLEAN AS $$
DECLARE
  key TEXT;
BEGIN
  IF attrs IS NULL THEN
    RETURN TRUE;
  END IF;
  FOR key IN SELECT jsonb_object_keys(attrs)
  LOOP
    IF key NOT IN (
      'max_refund_amount', 'max_cashout_amount', 'max_cashin_amount', 'daily_limit',
      'refund_minutes', 'allowed_tills', 'allowed_stores', 'allowed_agents',
      'allowed_channels', 'device_binding'
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE memberships ADD CONSTRAINT chk_member_attributes_whitelist CHECK (validate_member_attributes(member_attributes));

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================
ALTER TABLE roles ADD COLUMN scope role_scope NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE roles ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  scope       role_scope NOT NULL DEFAULT 'SYSTEM',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE role_bindings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id UUID NOT NULL REFERENCES memberships(id),
  role_id       UUID NOT NULL REFERENCES roles(id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by    UUID REFERENCES users(id)
);

CREATE INDEX idx_role_bindings_membership ON role_bindings(membership_id);

-- ============================================================
-- MERCHANTS: Stores & Tills
-- ============================================================
CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id  UUID NOT NULL REFERENCES principals(id),
  country_code  CHAR(2) NOT NULL REFERENCES countries(code),
  store_number  VARCHAR(50) NOT NULL UNIQUE,
  legal_name    VARCHAR(255) NOT NULL,
  status        store_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_country_status ON stores(country_code, status);
CREATE UNIQUE INDEX idx_stores_principal ON stores(principal_id);

CREATE TABLE tills (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES stores(id),
  till_number   VARCHAR(50) NOT NULL UNIQUE,
  status        store_status NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tills_store ON tills(store_id);

CREATE TABLE membership_tills (
  membership_id UUID NOT NULL REFERENCES memberships(id),
  till_id       UUID NOT NULL REFERENCES tills(id),
  PRIMARY KEY (membership_id, till_id)
);

-- ============================================================
-- AGENTS: Hierarchy
-- ============================================================
CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id  UUID NOT NULL REFERENCES principals(id),
  country_code  CHAR(2) NOT NULL REFERENCES countries(code),
  agent_number  VARCHAR(50) NOT NULL UNIQUE,
  level         SMALLINT NOT NULL DEFAULT 1,
  parent_agent_id UUID REFERENCES agents(id),
  status        agent_status NOT NULL DEFAULT 'PENDING',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_agent_level CHECK (level >= 1 AND level <= 3)
);

CREATE INDEX idx_agents_country_status ON agents(country_code, status);
CREATE UNIQUE INDEX idx_agents_principal ON agents(principal_id);

-- ============================================================
-- KYC REQUIREMENTS & PROFILES
-- ============================================================
CREATE TABLE kyc_requirement_sets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code   CHAR(2) NOT NULL REFERENCES countries(code),
  user_type      principal_type NOT NULL,
  tier           VARCHAR(50) NOT NULL,
  version        SMALLINT NOT NULL,
  effective_from DATE NOT NULL,
  status         kyc_requirement_status NOT NULL DEFAULT 'DRAFT',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, user_type, tier, version)
);

CREATE INDEX idx_kyc_sets_active ON kyc_requirement_sets(country_code, user_type, tier, status, effective_from);

CREATE TABLE kyc_requirement_fields (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requirement_set_id UUID NOT NULL REFERENCES kyc_requirement_sets(id),
  field_key         VARCHAR(100) NOT NULL,
  field_type        VARCHAR(50) NOT NULL,
  required          BOOLEAN NOT NULL DEFAULT true,
  rules_json        JSONB NOT NULL DEFAULT '{}',
  source            VARCHAR(50) NOT NULL DEFAULT 'USER',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_fields_set ON kyc_requirement_fields(requirement_set_id);

CREATE TABLE kyc_requirement_documents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requirement_set_id UUID NOT NULL REFERENCES kyc_requirement_sets(id),
  doc_type          VARCHAR(100) NOT NULL,
  required          BOOLEAN NOT NULL DEFAULT true,
  min_count         SMALLINT NOT NULL DEFAULT 1,
  rules_json        JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_docs_set ON kyc_requirement_documents(requirement_set_id);

CREATE TABLE kyc_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code    CHAR(2) NOT NULL REFERENCES countries(code),
  user_type       principal_type NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(id),
  tier            VARCHAR(50) NOT NULL,
  status          kyc_profile_status NOT NULL DEFAULT 'NOT_SUBMITTED',
  requirement_set_id UUID REFERENCES kyc_requirement_sets(id),
  version_applied SMALLINT,
  risk_score      SMALLINT NOT NULL DEFAULT 0,
  risk_reason     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tier)
);

CREATE INDEX idx_kyc_profiles_country_status ON kyc_profiles(country_code, status, created_at);

CREATE TABLE kyc_profile_data (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID NOT NULL REFERENCES kyc_profiles(id),
  field_key       VARCHAR(100) NOT NULL,
  value_encrypted JSONB NOT NULL,
  metadata_hash   CHAR(64) NOT NULL,
  verification_status kyc_verification_status NOT NULL DEFAULT 'PENDING',
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, field_key)
);

CREATE INDEX idx_kyc_data_profile ON kyc_profile_data(profile_id);

CREATE TABLE kyc_documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID NOT NULL REFERENCES kyc_profiles(id),
  doc_type        VARCHAR(100) NOT NULL,
  file_ref        VARCHAR(255) NOT NULL,
  file_hash       CHAR(64) NOT NULL,
  metadata_hash   CHAR(64) NOT NULL,
  metadata_encrypted JSONB NOT NULL DEFAULT '{}',
  status          kyc_verification_status NOT NULL DEFAULT 'PENDING',
  verified_by     UUID REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_documents_profile ON kyc_documents(profile_id);

CREATE TABLE kyc_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL DEFAULT uuid_generate_v4(),
  profile_id      UUID NOT NULL REFERENCES kyc_profiles(id),
  queue           VARCHAR(100) NOT NULL,
  status          kyc_review_status NOT NULL DEFAULT 'OPEN',
  assigned_to     UUID REFERENCES users(id),
  decision        VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_reviews_queue ON kyc_reviews(queue, status, created_at);

-- ============================================================
-- CONFIG: Permission Catalogs & Policy Bundles
-- ============================================================
CREATE TABLE permission_catalogs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code   CHAR(2) NOT NULL REFERENCES countries(code),
  version        SMALLINT NOT NULL,
  status         kyc_requirement_status NOT NULL DEFAULT 'DRAFT',
  effective_from DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, version)
);

CREATE TABLE policy_bundles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code   CHAR(2) NOT NULL REFERENCES countries(code),
  version        SMALLINT NOT NULL,
  status         kyc_requirement_status NOT NULL DEFAULT 'DRAFT',
  effective_from DATE NOT NULL,
  bundle_json    JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, version)
);

CREATE TABLE data_retention_policies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code   CHAR(2) NOT NULL REFERENCES countries(code),
  data_type      VARCHAR(100) NOT NULL,
  retention_days INT NOT NULL,
  legal_hold     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, data_type)
);

-- ============================================================
-- LEDGER GUARDRAILS
-- ============================================================
ALTER TABLE journal_entries ADD COLUMN reference TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE journal_entries ADD COLUMN entry_hash CHAR(64);

UPDATE journal_entries
SET entry_hash = encode(digest(id::text || '|' || description || '|' || business_day::text, 'sha256'), 'hex')
WHERE entry_hash IS NULL;

ALTER TABLE journal_entries ALTER COLUMN entry_hash SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN reference DROP DEFAULT;
ALTER TABLE journal_entries ADD CONSTRAINT chk_journal_reference CHECK (length(trim(reference)) > 0);
ALTER TABLE journal_entries ADD CONSTRAINT chk_journal_description CHECK (length(trim(description)) > 0);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger tables are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE OR REPLACE FUNCTION ledger_post_entry(
  p_subledger owner_type,
  p_description TEXT,
  p_reference TEXT,
  p_correlation_id UUID,
  p_idempotency_key VARCHAR,
  p_business_day DATE,
  p_metadata JSONB,
  p_lines JSONB,
  p_reversed_entry_id UUID DEFAULT NULL
) RETURNS TABLE(entry_id UUID, entry_number BIGINT, status entry_status, created_at TIMESTAMPTZ, entry_hash CHAR(64)) AS $$
DECLARE
  v_line_count INT;
  v_currency_count INT;
  v_debits NUMERIC;
  v_credits NUMERIC;
  v_entry_id UUID := uuid_generate_v4();
  v_entry_hash CHAR(64);
BEGIN
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Narration is required';
  END IF;
  IF p_reference IS NULL OR length(trim(p_reference)) = 0 THEN
    RAISE EXCEPTION 'Reference is required';
  END IF;

  SELECT count(*) INTO v_line_count FROM jsonb_array_elements(p_lines);
  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'A journal entry must have at least 2 lines';
  END IF;

  SELECT count(DISTINCT (line->>'currencyCode')) INTO v_currency_count
  FROM jsonb_array_elements(p_lines) line;
  IF v_currency_count <> 1 THEN
    RAISE EXCEPTION 'All lines in an entry must use the same currency';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_lines) line
    WHERE (line->>'amount')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Amounts must be positive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_lines) line
    JOIN ledger_accounts la ON la.id = (line->>'accountId')::uuid
    WHERE la.currency_code <> (line->>'currencyCode')::char(3)
  ) THEN
    RAISE EXCEPTION 'Account currency mismatch';
  END IF;

  SELECT
    sum(CASE WHEN (line->>'debitCredit') = 'DEBIT' THEN (line->>'amount')::numeric ELSE 0 END),
    sum(CASE WHEN (line->>'debitCredit') = 'CREDIT' THEN (line->>'amount')::numeric ELSE 0 END)
  INTO v_debits, v_credits
  FROM jsonb_array_elements(p_lines) line;

  IF v_debits IS NULL OR v_credits IS NULL OR abs(v_debits - v_credits) > 0.00000001 THEN
    RAISE EXCEPTION 'Debits must equal credits';
  END IF;

  v_entry_hash := encode(digest(
    p_subledger::text || '|' || p_description || '|' || p_reference || '|' ||
    p_business_day::text || '|' || p_idempotency_key || '|' || coalesce(p_reversed_entry_id::text, '') || '|' ||
    coalesce(p_metadata::text, '{}') || '|' || p_lines::text,
    'sha256'
  ), 'hex');

  INSERT INTO journal_entries (
    id, subledger, description, reference, correlation_id, idempotency_key, business_day, metadata, entry_hash, reversed_entry_id
  ) VALUES (
    v_entry_id, p_subledger, p_description, p_reference, p_correlation_id, p_idempotency_key,
    p_business_day, coalesce(p_metadata, '{}'::jsonb), v_entry_hash, p_reversed_entry_id
  ) ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id, entry_number, status, created_at, entry_hash
  INTO entry_id, entry_number, status, created_at, entry_hash;

  IF NOT FOUND THEN
    SELECT id, entry_number, status, created_at, entry_hash
    INTO entry_id, entry_number, status, created_at, entry_hash
    FROM journal_entries WHERE idempotency_key = p_idempotency_key;
    IF entry_hash <> v_entry_hash THEN
      RAISE EXCEPTION 'Idempotency key conflict';
    END IF;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO journal_lines (entry_id, account_id, debit_credit, amount, currency_code, line_number)
  SELECT
    v_entry_id,
    (line->>'accountId')::uuid,
    (line->>'debitCredit')::debit_credit,
    (line->>'amount')::numeric,
    (line->>'currencyCode')::char(3),
    ordinality
  FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS line(line, ordinality);

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- IDEMPOTENCY EXTENSION
-- ============================================================
ALTER TABLE idempotency_keys ADD COLUMN request_hash CHAR(64);
ALTER TABLE idempotency_keys ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- SEED: Default Roles & Permissions (Phase 2)
-- ============================================================
INSERT INTO roles (name, description, scope, is_default) VALUES
  ('CUSTOMER_SELF', 'Customer self role', 'CUSTOMER', true),
  ('MERCHANT_OWNER', 'Merchant owner full access', 'MERCHANT', true),
  ('MERCHANT_MANAGER', 'Merchant manager access', 'MERCHANT', false),
  ('MERCHANT_CASHIER', 'Merchant cashier access', 'MERCHANT', false),
  ('MERCHANT_VIEWER', 'Merchant viewer access', 'MERCHANT', false),
  ('AGENT_OWNER', 'Agent owner access', 'AGENT', true),
  ('AGENT_SUPERVISOR', 'Agent supervisor access', 'AGENT', false),
  ('AGENT_TELLER', 'Agent teller access', 'AGENT', false),
  ('AGENT_VIEWER', 'Agent viewer access', 'AGENT', false),
  ('STAFF_COMPLIANCE', 'Compliance staff', 'STAFF', false),
  ('STAFF_FINANCE', 'Finance staff', 'STAFF', false),
  ('STAFF_OPS', 'Operations staff', 'STAFF', false),
  ('STAFF_SUPPORT', 'Support staff', 'STAFF', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, scope) VALUES
  ('ledger.post', 'Post ledger entries', 'SYSTEM'),
  ('ledger.read', 'Read ledger entries', 'SYSTEM'),
  ('kyc.submit', 'Submit KYC information', 'CUSTOMER'),
  ('kyc.review', 'Review KYC cases', 'STAFF'),
  ('merchant.user.manage', 'Manage merchant users', 'MERCHANT'),
  ('merchant.role.manage', 'Manage merchant roles', 'MERCHANT'),
  ('agent.user.manage', 'Manage agent users', 'AGENT'),
  ('agent.role.manage', 'Manage agent roles', 'AGENT')
ON CONFLICT (name) DO NOTHING;

-- Seed minimal KYC requirement set for BB customers
INSERT INTO kyc_requirement_sets (country_code, user_type, tier, version, effective_from, status)
VALUES ('BB', 'CUSTOMER', 'TIER_0', 1, CURRENT_DATE, 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO kyc_requirement_fields (requirement_set_id, field_key, field_type, required)
SELECT id, 'dob', 'date', true
FROM kyc_requirement_sets
WHERE country_code = 'BB' AND user_type = 'CUSTOMER' AND tier = 'TIER_0' AND version = 1
ON CONFLICT DO NOTHING;

INSERT INTO kyc_requirement_documents (requirement_set_id, doc_type, required, min_count)
SELECT id, 'NATIONAL_ID', true, 1
FROM kyc_requirement_sets
WHERE country_code = 'BB' AND user_type = 'CUSTOMER' AND tier = 'TIER_0' AND version = 1
ON CONFLICT DO NOTHING;
