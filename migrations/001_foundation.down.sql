-- Migration 001 Down: Drop all Phase 1 tables
-- WARNING: This is destructive and irreversible in production.

DROP TABLE IF EXISTS rate_limit_events CASCADE;
DROP TABLE IF EXISTS inbox_events CASCADE;
DROP TABLE IF EXISTS outbox_events CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS account_balance_projections CASCADE;
DROP TABLE IF EXISTS journal_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS ledger_accounts CASCADE;
DROP TABLE IF EXISTS principal_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS principals CASCADE;
DROP TABLE IF EXISTS country_currencies CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS countries CASCADE;

DROP TYPE IF EXISTS audit_actor_type;
DROP TYPE IF EXISTS principal_status;
DROP TYPE IF EXISTS principal_type;
DROP TYPE IF EXISTS outbox_status;
DROP TYPE IF EXISTS debit_credit;
DROP TYPE IF EXISTS entry_status;
DROP TYPE IF EXISTS owner_type;
DROP TYPE IF EXISTS account_type;
DROP TYPE IF EXISTS account_status;
