# Caricash Phase 1 Threat Model

## Top 10 Threats and Mitigations

### 1. SQL Injection
**Risk**: High
**Mitigation**: All queries use parameterized statements via node-postgres. No string interpolation in SQL. Repository pattern enforces this.

### 2. Credential Theft (PIN)
**Risk**: High
**Mitigation**: PINs hashed with argon2id (64MB memory, 3 iterations). Never stored in plaintext. Never logged.

### 3. Brute Force PIN Attacks
**Risk**: Medium
**Mitigation**: Max 5 attempts before 30-minute lockout. Rate limiting via Redis. Failed attempts tracked in DB.

### 4. JWT Token Theft
**Risk**: Medium
**Mitigation**: Short-lived access tokens (15 min). Refresh tokens hashed in DB. Token revocation on logout.

### 5. Ledger Manipulation
**Risk**: Critical
**Mitigation**: Immutable journal entries (no UPDATE/DELETE). DB constraints enforce positive amounts. Debits=credits validated in code and DB.

### 6. Event Replay/Duplication
**Risk**: Medium
**Mitigation**: Idempotency keys for all financial operations. Inbox dedup for all consumers. Outbox pattern for reliable publishing.

### 7. Audit Trail Tampering
**Risk**: High
**Mitigation**: SHA-256 hash chain. Verification tool. Append-only table. No UPDATE/DELETE at application level.

### 8. Unauthorized Access
**Risk**: High
**Mitigation**: Policy engine (RBAC). Staff OAuth. JWT auth. API versioning with global prefix.

### 9. Secrets in Source Code
**Risk**: High
**Mitigation**: .env.example with placeholder values. .gitignore excludes .env files. Docker secrets for production.

### 10. Missing Correlation/Tracing
**Risk**: Low
**Mitigation**: X-Correlation-ID and X-Request-ID on every request. Structured JSON logging with pino.

## Stop-the-Line Conditions
These conditions MUST halt the build/deployment:

1. ❌ Any path that changes balances without a journal entry
2. ❌ Any financial POST endpoint without idempotency key enforcement
3. ❌ Any posted journal entry that can be updated or deleted
4. ❌ Any consumer processing without inbox dedup check
5. ❌ Any audit event missing hash chain linkage
6. ❌ Any secret committed to repository or logged
7. ❌ Any PIN stored unhashed or with weak algorithm (non-argon2id)
