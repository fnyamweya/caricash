-- Migration 004: Phase 4 - Settlement, EOD Reconciliation, Disputes, Maker-Checker, CoS Engine

-- ============================================================
-- ENUMS: Phase 4
-- ============================================================
CREATE TYPE settlement_status AS ENUM (
  'PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED'
);
CREATE TYPE settlement_line_status AS ENUM ('INCLUDED', 'EXCLUDED', 'DISPUTED');
CREATE TYPE merchant_hold_status AS ENUM ('ACTIVE', 'RELEASED', 'FORFEITED');
CREATE TYPE dispute_status AS ENUM (
  'OPEN', 'INVESTIGATING', 'RESOLVED_MERCHANT', 'RESOLVED_CUSTOMER', 'CLOSED'
);
CREATE TYPE chargeback_status AS ENUM (
  'OPENED', 'SUBMITTED', 'WON', 'LOST', 'REVERSED'
);
CREATE TYPE approval_status AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED', 'CANCELLED'
);
CREATE TYPE approval_action_type AS ENUM (
  'PRICING_CHANGE', 'COS_CHANGE', 'SETTLEMENT_BANK_CHANGE',
  'MANUAL_FLOAT_ADJUSTMENT', 'REVERSAL_OVERRIDE', 'WEBHOOK_REPLAY',
  'AGENT_HIERARCHY_CHANGE'
);
CREATE TYPE cos_match_mode AS ENUM ('FIRST', 'ACCUMULATE');
CREATE TYPE cos_output_type AS ENUM ('MEMO', 'LEDGER_POSTING');
CREATE TYPE reconciliation_status AS ENUM (
  'PENDING', 'MATCHED', 'PARTIAL_MATCH', 'UNMATCHED', 'EXCEPTION'
);
CREATE TYPE reconciliation_run_status AS ENUM (
  'RUNNING', 'COMPLETED', 'FAILED'
);

-- ============================================================
-- 4.2 MERCHANT SETTLEMENT SUBLEDGER
-- ============================================================

-- Derived/projected merchant balance (not source of truth)
CREATE TABLE merchant_balances (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id      UUID NOT NULL,       -- merchant principal
  store_id          UUID,                -- optional per-store balance
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  available_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
  held_balance      NUMERIC(20,8) NOT NULL DEFAULT 0,
  pending_settlement NUMERIC(20,8) NOT NULL DEFAULT 0,
  last_entry_id     UUID REFERENCES journal_entries(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (principal_id, store_id, currency_code)
);

CREATE INDEX idx_merchant_balances_principal ON merchant_balances(principal_id);

CREATE TABLE settlements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id      UUID NOT NULL,       -- merchant
  store_id          UUID,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  gross_amount      NUMERIC(20,8) NOT NULL DEFAULT 0,
  fee_amount        NUMERIC(20,8) NOT NULL DEFAULT 0,
  hold_amount       NUMERIC(20,8) NOT NULL DEFAULT 0,
  net_amount        NUMERIC(20,8) NOT NULL DEFAULT 0,
  status            settlement_status NOT NULL DEFAULT 'PENDING',
  journal_entry_id  UUID REFERENCES journal_entries(id),
  paid_at           TIMESTAMPTZ,
  bank_reference    VARCHAR(255),
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlements_principal ON settlements(principal_id, status);
CREATE INDEX idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX idx_settlements_status ON settlements(status);

CREATE TABLE settlement_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id   UUID NOT NULL REFERENCES settlements(id),
  business_day    DATE NOT NULL,
  product_code    VARCHAR(50),
  store_id        UUID,
  till_id         UUID,
  gross_amount    NUMERIC(20,8) NOT NULL DEFAULT 0,
  fee_amount      NUMERIC(20,8) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(20,8) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  status          settlement_line_status NOT NULL DEFAULT 'INCLUDED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_lines_settlement ON settlement_lines(settlement_id);
CREATE INDEX idx_settlement_lines_day ON settlement_lines(business_day);

CREATE TABLE merchant_holds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id    UUID NOT NULL,       -- merchant
  store_id        UUID,
  dispute_id      UUID,                -- linked to dispute if applicable
  amount          NUMERIC(20,8) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  status          merchant_hold_status NOT NULL DEFAULT 'ACTIVE',
  reason          TEXT NOT NULL,
  placed_by       UUID,
  released_by     UUID,
  released_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_holds_principal ON merchant_holds(principal_id, status);
CREATE INDEX idx_merchant_holds_dispute ON merchant_holds(dispute_id)
  WHERE dispute_id IS NOT NULL;

-- ============================================================
-- 4.3 EOD RECONCILIATION
-- ============================================================

-- Business day close tracking
CREATE TABLE ledger_day_close (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_day    DATE NOT NULL UNIQUE,
  closed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by       UUID,
  report_hash     CHAR(64) NOT NULL,   -- SHA-256 hash of reports
  entry_count     INTEGER NOT NULL DEFAULT 0,
  total_debits    NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_credits   NUMERIC(20,8) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent mutation of day close records
CREATE TRIGGER trg_ledger_day_close_immutable
  BEFORE UPDATE OR DELETE ON ledger_day_close
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- Bank statement import
CREATE TABLE bank_statements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_code       VARCHAR(20) NOT NULL,
  account_number  VARCHAR(50) NOT NULL,
  statement_date  DATE NOT NULL,
  opening_balance NUMERIC(20,8) NOT NULL,
  closing_balance NUMERIC(20,8) NOT NULL,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  imported_by     UUID,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bank_statement_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id    UUID NOT NULL REFERENCES bank_statements(id),
  line_number     INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  value_date      DATE,
  description     TEXT,
  amount          NUMERIC(20,8) NOT NULL,
  debit_credit    debit_credit NOT NULL,
  reference       VARCHAR(255),
  bank_reference  VARCHAR(255),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_statement_lines_stmt ON bank_statement_lines(statement_id, line_number);

-- Reconciliation engine
CREATE TABLE reconciliation_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type        VARCHAR(50) NOT NULL,  -- 'BANK_SUSPENSE', 'SETTLEMENT_PAYABLE'
  business_day    DATE NOT NULL,
  status          reconciliation_run_status NOT NULL DEFAULT 'RUNNING',
  total_items     INTEGER NOT NULL DEFAULT 0,
  matched_items   INTEGER NOT NULL DEFAULT 0,
  unmatched_items INTEGER NOT NULL DEFAULT 0,
  exception_items INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  run_by          UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_runs_day ON reconciliation_runs(business_day, run_type);

CREATE TABLE reconciliation_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          UUID NOT NULL REFERENCES reconciliation_runs(id),
  status          reconciliation_status NOT NULL DEFAULT 'PENDING',
  source_type     VARCHAR(50) NOT NULL,   -- 'BANK_LINE', 'JOURNAL_ENTRY'
  source_id       UUID NOT NULL,
  matched_type    VARCHAR(50),
  matched_id      UUID,
  amount          NUMERIC(20,8) NOT NULL,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  difference      NUMERIC(20,8),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_items_run ON reconciliation_items(run_id, status);
CREATE INDEX idx_recon_items_source ON reconciliation_items(source_type, source_id);

CREATE TABLE reconciliation_exceptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          UUID NOT NULL REFERENCES reconciliation_runs(id),
  item_id         UUID REFERENCES reconciliation_items(id),
  exception_type  VARCHAR(50) NOT NULL,   -- 'MISSING_MATCH', 'AMOUNT_MISMATCH', 'DUPLICATE'
  description     TEXT NOT NULL,
  amount          NUMERIC(20,8),
  currency_code   CHAR(3) REFERENCES currencies(code),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_exceptions_run ON reconciliation_exceptions(run_id, resolved);

-- ============================================================
-- 4.4 DISPUTES / CHARGEBACKS
-- ============================================================
CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES payments(id),
  store_id        UUID,
  principal_id    UUID NOT NULL,        -- merchant
  status          dispute_status NOT NULL DEFAULT 'OPEN',
  reason          TEXT NOT NULL,
  amount          NUMERIC(20,8) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  hold_id         UUID REFERENCES merchant_holds(id),
  resolution      TEXT,
  resolved_by     UUID,
  resolved_at     TIMESTAMPTZ,
  journal_entry_id UUID REFERENCES journal_entries(id),   -- reversal/adjustment entry
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_payment ON disputes(payment_id);
CREATE INDEX idx_disputes_principal ON disputes(principal_id, status);
CREATE INDEX idx_disputes_status ON disputes(status);

CREATE TABLE chargebacks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id      UUID NOT NULL REFERENCES disputes(id),
  payment_id      UUID NOT NULL REFERENCES payments(id),
  status          chargeback_status NOT NULL DEFAULT 'OPENED',
  amount          NUMERIC(20,8) NOT NULL CHECK (amount > 0),
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  rail_reference  VARCHAR(255),
  reason_code     VARCHAR(50),
  journal_entry_id UUID REFERENCES journal_entries(id),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chargebacks_dispute ON chargebacks(dispute_id);
CREATE INDEX idx_chargebacks_payment ON chargebacks(payment_id);
CREATE INDEX idx_chargebacks_status ON chargebacks(status);

-- ============================================================
-- 4.5 MAKER-CHECKER (Four-Eyes Approval)
-- ============================================================
CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type     approval_action_type NOT NULL,
  status          approval_status NOT NULL DEFAULT 'PENDING',
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  correlation_id  UUID NOT NULL,
  requested_by    UUID NOT NULL,        -- maker
  description     TEXT NOT NULL,
  payload         JSONB NOT NULL,       -- the action parameters
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     VARCHAR(255),
  expires_at      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_requests_status ON approval_requests(status)
  WHERE status = 'PENDING';
CREATE INDEX idx_approval_requests_action ON approval_requests(action_type, status);
CREATE INDEX idx_approval_requests_maker ON approval_requests(requested_by);

CREATE TABLE approval_decisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES approval_requests(id),
  decided_by      UUID NOT NULL,        -- checker
  decision        VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_decisions_request ON approval_decisions(request_id);

-- Block maker = checker
CREATE OR REPLACE FUNCTION check_maker_checker()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.decided_by = (SELECT requested_by FROM approval_requests WHERE id = NEW.request_id) THEN
    RAISE EXCEPTION 'Maker and checker must be different users (four-eyes principle)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maker_checker_enforcement
  BEFORE INSERT ON approval_decisions
  FOR EACH ROW EXECUTE FUNCTION check_maker_checker();

CREATE TABLE approval_execution (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id      UUID NOT NULL REFERENCES approval_requests(id) UNIQUE,
  decision_id     UUID NOT NULL REFERENCES approval_decisions(id),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result          JSONB NOT NULL DEFAULT '{}',
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4.6 DYNAMIC CoS RULES ENGINE
-- ============================================================
CREATE TABLE cos_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  match_mode      cos_match_mode NOT NULL DEFAULT 'FIRST',
  -- Safe JSON AST conditions (no arbitrary code)
  conditions      JSONB NOT NULL,
  -- [{field, operator, value}]
  -- operators: eq, ne, gt, gte, lt, lte, in, not_in, between
  output_type     cos_output_type NOT NULL DEFAULT 'MEMO',
  -- Components: what to compute
  components      JSONB NOT NULL,
  -- [{name, calcType: FLAT|PERCENTAGE|TIERED, flat, rate, tiers, memo}]
  priority        INTEGER NOT NULL DEFAULT 100,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cos_rules_active ON cos_rules(is_active, priority)
  WHERE is_active = true;

-- Cost quote per transaction and per reconciliation run
CREATE TABLE cos_quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID REFERENCES payments(id),
  recon_run_id    UUID REFERENCES reconciliation_runs(id),
  total_cost      NUMERIC(20,8) NOT NULL DEFAULT 0,
  currency_code   CHAR(3) NOT NULL REFERENCES currencies(code),
  -- Full trace: which rules matched and produced what
  rule_trace      JSONB NOT NULL DEFAULT '[]',
  -- [{ruleId, ruleName, matchMode, conditions_matched, components: [{name, amount, memo}]}]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cos_quotes_payment ON cos_quotes(payment_id)
  WHERE payment_id IS NOT NULL;
CREATE INDEX idx_cos_quotes_recon ON cos_quotes(recon_run_id)
  WHERE recon_run_id IS NOT NULL;
