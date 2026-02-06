-- Rollback Migration 004

-- Drop CoS tables
DROP TABLE IF EXISTS cos_quotes;
DROP TABLE IF EXISTS cos_rules;

-- Drop maker-checker tables
DROP TABLE IF EXISTS approval_execution;
DROP TRIGGER IF EXISTS trg_maker_checker_enforcement ON approval_decisions;
DROP FUNCTION IF EXISTS check_maker_checker;
DROP TABLE IF EXISTS approval_decisions;
DROP TABLE IF EXISTS approval_requests;

-- Drop dispute tables
DROP TABLE IF EXISTS chargebacks;
DROP TABLE IF EXISTS disputes;

-- Drop reconciliation tables
DROP TABLE IF EXISTS reconciliation_exceptions;
DROP TABLE IF EXISTS reconciliation_items;
DROP TABLE IF EXISTS reconciliation_runs;

-- Drop bank statement tables
DROP TABLE IF EXISTS bank_statement_lines;
DROP TABLE IF EXISTS bank_statements;

-- Drop EOD tables
DROP TRIGGER IF EXISTS trg_ledger_day_close_immutable ON ledger_day_close;
DROP TABLE IF EXISTS ledger_day_close;

-- Drop settlement tables
DROP TABLE IF EXISTS merchant_holds;
DROP TABLE IF EXISTS settlement_lines;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS merchant_balances;

-- Drop enums
DROP TYPE IF EXISTS reconciliation_run_status;
DROP TYPE IF EXISTS reconciliation_status;
DROP TYPE IF EXISTS cos_output_type;
DROP TYPE IF EXISTS cos_match_mode;
DROP TYPE IF EXISTS approval_action_type;
DROP TYPE IF EXISTS approval_status;
DROP TYPE IF EXISTS chargeback_status;
DROP TYPE IF EXISTS dispute_status;
DROP TYPE IF EXISTS merchant_hold_status;
DROP TYPE IF EXISTS settlement_line_status;
DROP TYPE IF EXISTS settlement_status;
