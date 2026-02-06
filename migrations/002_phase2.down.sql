-- Rollback Migration 002

-- Drop ledger guardrails
DROP FUNCTION IF EXISTS ledger_post_entry;
DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON journal_lines;
DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON journal_entries;
DROP FUNCTION IF EXISTS prevent_ledger_mutation;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS chk_journal_reference;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS chk_journal_description;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS entry_hash;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS reference;

-- Drop config tables
DROP TABLE IF EXISTS data_retention_policies;
DROP TABLE IF EXISTS policy_bundles;
DROP TABLE IF EXISTS permission_catalogs;

-- Drop KYC tables
DROP TABLE IF EXISTS kyc_reviews;
DROP TABLE IF EXISTS kyc_documents;
DROP TABLE IF EXISTS kyc_profile_data;
DROP TABLE IF EXISTS kyc_profiles;
DROP TABLE IF EXISTS kyc_requirement_documents;
DROP TABLE IF EXISTS kyc_requirement_fields;
DROP TABLE IF EXISTS kyc_requirement_sets;

-- Drop agent/merchant tables
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS membership_tills;
DROP TABLE IF EXISTS tills;
DROP TABLE IF EXISTS stores;

-- Drop IAM tables
DROP TABLE IF EXISTS role_bindings;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
ALTER TABLE roles DROP COLUMN IF EXISTS scope;
ALTER TABLE roles DROP COLUMN IF EXISTS is_default;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS principals;

-- Drop enums
DROP TYPE IF EXISTS kyc_verification_status;
DROP TYPE IF EXISTS kyc_review_status;
DROP TYPE IF EXISTS kyc_profile_status;
DROP TYPE IF EXISTS kyc_requirement_status;
DROP TYPE IF EXISTS agent_status;
DROP TYPE IF EXISTS store_status;
DROP TYPE IF EXISTS role_scope;
DROP TYPE IF EXISTS membership_status;
DROP TYPE IF EXISTS principal_kind;

-- Revert idempotency_keys
ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS request_hash;
ALTER TABLE idempotency_keys DROP COLUMN IF EXISTS updated_at;

-- Revert user_roles -> principal_roles
ALTER TABLE user_roles RENAME COLUMN user_id TO principal_id;
ALTER TABLE user_roles RENAME TO principal_roles;

ALTER TABLE principal_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE principal_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE principal_roles ADD CONSTRAINT principal_roles_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES users(id);
ALTER TABLE principal_roles ADD CONSTRAINT principal_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);

-- Revert refresh_tokens
ALTER TABLE refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_fkey;
ALTER TABLE refresh_tokens RENAME COLUMN user_id TO principal_id;
ALTER TABLE refresh_tokens ADD CONSTRAINT refresh_tokens_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES users(id);

-- Revert users -> principals
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS msisdn;
ALTER TABLE users DROP COLUMN IF EXISTS country_code;
ALTER TABLE users RENAME TO principals;
ALTER INDEX idx_users_external_id RENAME TO idx_principals_external_id;
ALTER INDEX idx_users_type_status RENAME TO idx_principals_type_status;
ALTER INDEX idx_users_phone RENAME TO idx_principals_phone;
ALTER INDEX idx_users_email RENAME TO idx_principals_email;
DROP INDEX IF EXISTS idx_users_msisdn_country;
