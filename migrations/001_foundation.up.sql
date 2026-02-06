-- Migration 001: Foundation Schema
-- Caricash Phase 1: Ledger, Audit, Eventing, Identity, Config

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE account_status AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE account_type AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
CREATE TYPE owner_type AS ENUM ('CUSTOMER', 'AGENT', 'MERCHANT', 'SYSTEM');
CREATE TYPE entry_status AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE debit_credit AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE outbox_status AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');
CREATE TYPE principal_type AS ENUM ('CUSTOMER', 'AGENT', 'STAFF');
CREATE TYPE principal_status AS ENUM ('ACTIVE', 'LOCKED', 'SUSPENDED', 'CLOSED');
CREATE TYPE audit_actor_type AS ENUM ('CUSTOMER', 'AGENT', 'STAFF', 'SYSTEM');

-- ============================================================
-- CONFIG: Countries & Currencies
-- ============================================================
CREATE TABLE countries (
  code        CHAR(2) PRIMARY KEY,        -- ISO 3166-1 alpha-2
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE currencies (
  code        CHAR(3) PRIMARY KEY,        -- ISO 4217
  name        VARCHAR(100) NOT NULL,
  decimals    SMALLINT NOT NULL DEFAULT 2,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_currency_decimals CHECK (decimals >= 0 AND decimals <= 8)
);

CREATE TABLE country_currencies (
  country_code  CHAR(2) NOT NULL REFERENCES countries(code),
  currency_code CHAR(3) NOT NULL REFERENCES currencies(code),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (country_code, currency_code)
);

-- ============================================================
-- IDENTITY: Principals (customers, agents, staff)
-- ============================================================
CREATE TABLE principals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_type  principal_type NOT NULL,
  status          principal_status NOT NULL DEFAULT 'ACTIVE',
  external_id     VARCHAR(255),                    -- e.g., phone number, staff SSO id
  display_name    VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  pin_hash        TEXT,                             -- argon2id hash; NULL for staff (OAuth)
  failed_pin_attempts  INT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pin_required CHECK (
    (principal_type IN ('CUSTOMER', 'AGENT') AND pin_hash IS NOT NULL)
    OR principal_type = 'STAFF'
  )
);

CREATE UNIQUE INDEX idx_principals_external_id ON principals(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_principals_type_status ON principals(principal_type, status);
CREATE INDEX idx_principals_phone ON principals(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_principals_email ON principals(email) WHERE email IS NOT NULL;

-- ============================================================
-- IDENTITY: Refresh Tokens
-- ============================================================
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id    UUID NOT NULL REFERENCES principals(id),
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent      TEXT,
  ip_address      INET
);

CREATE INDEX idx_refresh_tokens_principal ON refresh_tokens(principal_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

-- ============================================================
-- IDENTITY: Roles & Permissions (for staff gating)
-- ============================================================
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE principal_roles (
  principal_id  UUID NOT NULL REFERENCES principals(id),
  role_id       UUID NOT NULL REFERENCES roles(id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by    UUID REFERENCES principals(id),
  PRIMARY KEY (principal_id, role_id)
);

-- ============================================================
-- LEDGER: Accounts
-- ============================================================
CREATE TABLE ledger_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_code    VARCHAR(50) NOT NULL UNIQUE,      -- e.g., CUST-<uuid>-BBD-WALLET
  owner_type      owner_type NOT NULL,
  owner_id        UUID NOT NULL,                     -- references principals.id or system
  account_type    account_type NOT NULL,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  status          account_status NOT NULL DEFAULT 'ACTIVE',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_accounts_owner ON ledger_accounts(owner_type, owner_id);
CREATE INDEX idx_ledger_accounts_currency ON ledger_accounts(currency_code);
CREATE INDEX idx_ledger_accounts_status ON ledger_accounts(status);

-- ============================================================
-- LEDGER: Journal Entries (immutable, append-only)
-- ============================================================
CREATE TABLE journal_entries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number      BIGSERIAL NOT NULL UNIQUE,        -- monotonic sequence
  subledger         owner_type NOT NULL,              -- CUSTOMER/AGENT/MERCHANT/SYSTEM
  description       TEXT NOT NULL,
  correlation_id    UUID NOT NULL,
  idempotency_key   VARCHAR(255) NOT NULL UNIQUE,
  business_day      DATE NOT NULL,
  status            entry_status NOT NULL DEFAULT 'POSTED',
  reversed_entry_id UUID REFERENCES journal_entries(id),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Immutability: no updated_at column. Entries are never modified.
  CONSTRAINT chk_reversal_status CHECK (
    (reversed_entry_id IS NULL AND status = 'POSTED')
    OR (reversed_entry_id IS NOT NULL)
  )
);

CREATE INDEX idx_journal_entries_correlation ON journal_entries(correlation_id);
CREATE INDEX idx_journal_entries_business_day ON journal_entries(business_day);
CREATE INDEX idx_journal_entries_subledger ON journal_entries(subledger);
CREATE INDEX idx_journal_entries_created ON journal_entries(created_at);

-- ============================================================
-- LEDGER: Journal Lines (immutable postings)
-- ============================================================
CREATE TABLE journal_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES journal_entries(id),
  account_id      UUID NOT NULL REFERENCES ledger_accounts(id),
  debit_credit    debit_credit NOT NULL,
  amount          NUMERIC(20, 8) NOT NULL,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  line_number     SMALLINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_positive_amount CHECK (amount > 0),
  CONSTRAINT uq_entry_line UNIQUE (entry_id, line_number)
);

CREATE INDEX idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_created ON journal_lines(created_at);

-- ============================================================
-- LEDGER: Balance Projection (NOT source of truth)
-- Updated asynchronously by worker from LedgerPosted events.
-- Source of truth is always journal_lines.
-- ============================================================
CREATE TABLE account_balance_projections (
  account_id      UUID PRIMARY KEY REFERENCES ledger_accounts(id),
  posted_balance  NUMERIC(20, 8) NOT NULL DEFAULT 0,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  last_entry_id   UUID REFERENCES journal_entries(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- IDEMPOTENCY: Request Dedup
-- ============================================================
CREATE TABLE idempotency_keys (
  key             VARCHAR(255) PRIMARY KEY,
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  status_code     SMALLINT NOT NULL,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================================
-- EVENTING: Outbox (transactional outbox pattern)
-- ============================================================
CREATE TABLE outbox_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      VARCHAR(255) NOT NULL,             -- e.g., 'LedgerPosted.v1'
  event_id        UUID NOT NULL DEFAULT uuid_generate_v4(),
  correlation_id  UUID,
  causation_id    UUID,
  schema_version  SMALLINT NOT NULL DEFAULT 1,
  payload         JSONB NOT NULL,
  status          outbox_status NOT NULL DEFAULT 'PENDING',
  retry_count     SMALLINT NOT NULL DEFAULT 0,
  max_retries     SMALLINT NOT NULL DEFAULT 5,
  next_retry_at   TIMESTAMPTZ,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_retry_count CHECK (retry_count >= 0)
);

CREATE INDEX idx_outbox_pending ON outbox_events(status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_outbox_created ON outbox_events(created_at);

-- ============================================================
-- EVENTING: Inbox Dedup (exactly-once per consumer)
-- ============================================================
CREATE TABLE inbox_events (
  message_id      UUID NOT NULL,
  consumer_group  VARCHAR(100) NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, consumer_group)
);

CREATE INDEX idx_inbox_processed ON inbox_events(processed_at);

-- ============================================================
-- AUDIT: Immutable Event Trail with Hash Chain
-- ============================================================
CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequence_number BIGSERIAL NOT NULL UNIQUE,         -- monotonic for chain verification
  actor_type      audit_actor_type NOT NULL,
  actor_id        UUID,                              -- NULL for system actions
  action          VARCHAR(255) NOT NULL,
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     VARCHAR(255),
  payload         JSONB NOT NULL DEFAULT '{}',
  correlation_id  UUID,
  request_id      UUID,
  ip_address      INET,
  user_agent      TEXT,
  prev_hash       CHAR(64),                          -- SHA-256 hex of previous event
  hash            CHAR(64) NOT NULL,                 -- SHA-256 hex of this event
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at: immutable append-only
);

CREATE INDEX idx_audit_actor ON audit_events(actor_type, actor_id);
CREATE INDEX idx_audit_action ON audit_events(action);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_correlation ON audit_events(correlation_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);
CREATE INDEX idx_audit_sequence ON audit_events(sequence_number);

-- ============================================================
-- SECURITY: Rate Limiting (metadata; actual limiting via Redis)
-- ============================================================
CREATE TABLE rate_limit_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id    UUID REFERENCES principals(id),
  action          VARCHAR(100) NOT NULL,
  ip_address      INET,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_principal ON rate_limit_events(principal_id, action, occurred_at);
CREATE INDEX idx_rate_limit_ip ON rate_limit_events(ip_address, action, occurred_at);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO countries (code, name) VALUES
  ('BB', 'Barbados'),
  ('US', 'United States');

INSERT INTO currencies (code, name, decimals) VALUES
  ('BBD', 'Barbadian Dollar', 2),
  ('USD', 'United States Dollar', 2);

INSERT INTO country_currencies (country_code, currency_code, is_default) VALUES
  ('BB', 'BBD', true),
  ('BB', 'USD', false),
  ('US', 'USD', true);

-- System roles
INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Full system administrator'),
  ('AUDITOR', 'Read-only audit access'),
  ('OPERATOR', 'Operational staff');

-- ============================================================
-- COMMENTS for documentation
-- ============================================================
COMMENT ON TABLE journal_entries IS 'Immutable double-entry journal. Never UPDATE or DELETE rows.';
COMMENT ON TABLE journal_lines IS 'Immutable posting lines. Never UPDATE or DELETE rows.';
COMMENT ON TABLE audit_events IS 'Append-only tamper-evident audit trail with hash chain.';
COMMENT ON TABLE account_balance_projections IS 'Async projection. NOT source of truth. Truth = journal_lines.';
COMMENT ON TABLE outbox_events IS 'Transactional outbox for reliable event publishing.';
COMMENT ON TABLE inbox_events IS 'Inbox dedup table for exactly-once consumer processing.';
