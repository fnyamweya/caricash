-- Migration 003: Phase 3 - Payments, Pricing, Webhooks, Notifications
-- Transaction orchestration, fee/commission engine, webhook delivery, notification outbox

-- ============================================================
-- ENUMS: Phase 3
-- ============================================================
CREATE TYPE payment_status AS ENUM (
  'INITIATED', 'AUTHORIZED', 'LEDGER_POSTED', 'NOTIFIED', 'COMPLETED', 'FAILED'
);

CREATE TYPE payment_type AS ENUM (
  'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'REFUND', 'REVERSAL'
);

CREATE TYPE pricing_rule_match_mode AS ENUM ('FIRST', 'ACCUMULATE');
CREATE TYPE pricing_component_type AS ENUM ('FEE', 'COMMISSION', 'TAX', 'DISCOUNT');

CREATE TYPE webhook_status AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE webhook_delivery_status AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DLQ');
CREATE TYPE webhook_attempt_result AS ENUM ('SUCCESS', 'TIMEOUT', 'ERROR', 'REJECTED');

CREATE TYPE notification_channel AS ENUM ('SMS', 'PUSH', 'EMAIL');
CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'DLQ');

-- ============================================================
-- 3.3 TRANSACTION ORCHESTRATION: Payments + Payment Events
-- ============================================================
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_type      payment_type NOT NULL,
  status            payment_status NOT NULL DEFAULT 'INITIATED',
  idempotency_key   VARCHAR(255) NOT NULL UNIQUE,
  correlation_id    UUID NOT NULL,

  -- parties
  payer_account_id  UUID REFERENCES ledger_accounts(id),
  payee_account_id  UUID REFERENCES ledger_accounts(id),
  payer_principal_id UUID,
  payee_principal_id UUID,

  -- amounts (string representation for precision)
  amount            NUMERIC(20,8) NOT NULL CHECK (amount > 0),
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  fee_amount        NUMERIC(20,8) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  commission_amount NUMERIC(20,8) NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  total_amount      NUMERIC(20,8) NOT NULL CHECK (total_amount > 0),

  -- references
  journal_entry_id  UUID REFERENCES journal_entries(id),
  pricing_quote_id  UUID,
  reference         VARCHAR(255),
  description       TEXT,
  business_day      DATE NOT NULL DEFAULT CURRENT_DATE,
  failure_reason    TEXT,
  failure_code      VARCHAR(50),
  metadata          JSONB NOT NULL DEFAULT '{}',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_correlation ON payments(correlation_id);
CREATE INDEX idx_payments_payer ON payments(payer_account_id) WHERE payer_account_id IS NOT NULL;
CREATE INDEX idx_payments_payee ON payments(payee_account_id) WHERE payee_account_id IS NOT NULL;
CREATE INDEX idx_payments_business_day ON payments(business_day);
CREATE INDEX idx_payments_type_status ON payments(payment_type, status);

-- Immutable audit trail of all state transitions
CREATE TABLE payment_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id      UUID NOT NULL REFERENCES payments(id),
  from_status     payment_status,
  to_status       payment_status NOT NULL,
  correlation_id  UUID NOT NULL,
  actor_type      audit_actor_type NOT NULL DEFAULT 'SYSTEM',
  actor_id        UUID,
  reason          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_events_payment ON payment_events(payment_id, created_at);
CREATE INDEX idx_payment_events_correlation ON payment_events(correlation_id);

-- Prevent mutation of payment_events (append-only)
CREATE TRIGGER trg_payment_events_immutable
  BEFORE UPDATE OR DELETE ON payment_events
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- ============================================================
-- 3.4 PRICING V1: Rules + Quotes
-- ============================================================
CREATE TABLE pricing_rules (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  payment_type      payment_type NOT NULL,
  component_type    pricing_component_type NOT NULL,
  match_mode        pricing_rule_match_mode NOT NULL DEFAULT 'FIRST',

  -- Scope / precedence (more specific = higher priority)
  country_code      CHAR(2) REFERENCES countries(code),
  product_code      VARCHAR(50),
  entity_id         UUID,

  -- Rule definition
  calc_type         VARCHAR(20) NOT NULL CHECK (calc_type IN ('FLAT', 'PERCENTAGE', 'TIERED')),
  flat_amount       NUMERIC(20,8),
  percentage_rate   NUMERIC(10,6),
  tier_config       JSONB,         -- For tiered: [{min, max, flat, rate}]
  min_amount        NUMERIC(20,8),
  max_amount        NUMERIC(20,8),
  currency_code     CHAR(3) REFERENCES currencies(code),

  -- Priority: lower number = higher priority
  priority          INTEGER NOT NULL DEFAULT 100,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  effective_from    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_lookup ON pricing_rules(payment_type, component_type, is_active)
  WHERE is_active = true;
CREATE INDEX idx_pricing_rules_country ON pricing_rules(country_code)
  WHERE country_code IS NOT NULL;
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority);

-- Store computed quote per transaction with rule trace
CREATE TABLE pricing_quotes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id        UUID REFERENCES payments(id),
  payment_type      payment_type NOT NULL,
  principal_amount  NUMERIC(20,8) NOT NULL,
  currency_code     CHAR(3) NOT NULL REFERENCES currencies(code),
  total_fees        NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_commission  NUMERIC(20,8) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(20,8) NOT NULL,

  -- Rule trace: which rules matched and what they computed
  rule_trace        JSONB NOT NULL DEFAULT '[]',
  -- [{ruleId, ruleName, componentType, calcType, inputAmount, outputAmount, priority}]

  country_code      CHAR(2) REFERENCES countries(code),
  entity_id         UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_quotes_payment ON pricing_quotes(payment_id)
  WHERE payment_id IS NOT NULL;

-- Add FK from payments to pricing_quotes
ALTER TABLE payments
  ADD CONSTRAINT fk_payments_pricing_quote
  FOREIGN KEY (pricing_quote_id) REFERENCES pricing_quotes(id);

-- ============================================================
-- 3.5 WEBHOOKS V1: Subscriptions + Delivery Engine + Logs
-- ============================================================
CREATE TABLE webhook_subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  principal_id    UUID NOT NULL,     -- merchant/entity owning this subscription
  url             TEXT NOT NULL,
  status          webhook_status NOT NULL DEFAULT 'ACTIVE',
  event_types     TEXT[] NOT NULL,   -- array of event type patterns

  -- Signing
  signing_key     TEXT NOT NULL,     -- HMAC SHA-256 secret
  signing_key_id  VARCHAR(100) NOT NULL,

  -- Config
  max_retries     INTEGER NOT NULL DEFAULT 5,
  timeout_ms      INTEGER NOT NULL DEFAULT 10000,
  metadata        JSONB NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_subs_principal ON webhook_subscriptions(principal_id, status);
CREATE INDEX idx_webhook_subs_status ON webhook_subscriptions(status)
  WHERE status = 'ACTIVE';

CREATE TABLE webhook_deliveries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id   UUID NOT NULL REFERENCES webhook_subscriptions(id),
  event_id          UUID NOT NULL,
  event_type        VARCHAR(255) NOT NULL,
  correlation_id    UUID NOT NULL,
  status            webhook_delivery_status NOT NULL DEFAULT 'PENDING',
  payload           JSONB NOT NULL,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 6,
  next_retry_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  dlq_at            TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_id);

CREATE TABLE webhook_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id     UUID NOT NULL REFERENCES webhook_deliveries(id),
  attempt_number  INTEGER NOT NULL,
  result          webhook_attempt_result NOT NULL,
  http_status     INTEGER,
  response_body   TEXT,
  response_time_ms INTEGER,
  error_message   TEXT,
  request_headers JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_attempts_delivery ON webhook_attempts(delivery_id, attempt_number);

-- ============================================================
-- 3.6 NOTIFICATIONS: Outbox-Driven Job Queue
-- ============================================================
CREATE TABLE notification_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correlation_id  UUID NOT NULL,
  channel         notification_channel NOT NULL,
  status          notification_status NOT NULL DEFAULT 'PENDING',
  recipient       VARCHAR(255) NOT NULL,
  template_code   VARCHAR(100) NOT NULL,
  template_params JSONB NOT NULL DEFAULT '{}',
  country_code    CHAR(2) REFERENCES countries(code),
  language_code   VARCHAR(10) NOT NULL DEFAULT 'en',
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  dlq_at          TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_jobs_status ON notification_jobs(status, next_retry_at)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_notification_jobs_correlation ON notification_jobs(correlation_id);
CREATE INDEX idx_notification_jobs_channel ON notification_jobs(channel, status);
