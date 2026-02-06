-- Rollback Migration 003

-- Drop notification tables
DROP TABLE IF EXISTS notification_jobs;

-- Drop webhook tables
DROP TABLE IF EXISTS webhook_attempts;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhook_subscriptions;

-- Drop pricing tables
ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_pricing_quote;
DROP TABLE IF EXISTS pricing_quotes;
DROP TABLE IF EXISTS pricing_rules;

-- Drop payment tables
DROP TRIGGER IF EXISTS trg_payment_events_immutable ON payment_events;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;

-- Drop enums
DROP TYPE IF EXISTS notification_status;
DROP TYPE IF EXISTS notification_channel;
DROP TYPE IF EXISTS webhook_attempt_result;
DROP TYPE IF EXISTS webhook_delivery_status;
DROP TYPE IF EXISTS webhook_status;
DROP TYPE IF EXISTS pricing_component_type;
DROP TYPE IF EXISTS pricing_rule_match_mode;
DROP TYPE IF EXISTS payment_type;
DROP TYPE IF EXISTS payment_status;
