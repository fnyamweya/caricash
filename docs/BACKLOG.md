# Caricash P0/P1 Backlog - Post-Audit Remediation

## Priority 0 (CRITICAL - Must Fix Immediately)

### P0-001: Implement Full Obligation Enforcement Handlers
**Status**: STUB_EXISTS  
**Description**: PolicyGuardMiddleware exists but enforcement handlers are stubs. Must implement real validation for:
- MfaEnforcementHandler
- DeviceBindingEnforcementHandler
- MakerCheckerEnforcementHandler
- KycTierEnforcementHandler
- All other handlers in registry

**Acceptance Criteria**:
- [ ] MFA assertion JWT validated with signature verification
- [ ] Device binding token verified against device_bindings table
- [ ] Maker-checker approval request ID verified with status=APPROVED
- [ ] KYC tier checked from kyc_profiles table
- [ ] Evidence validation unit tests with mocked assertions
- [ ] Integration test: request with missing evidence header is denied

**Tests Required**:
```typescript
// packages/policy/src/enforcement-handlers.test.ts
describe('MfaEnforcementHandler', () => {
  it('should deny request without X-MFA-ASSERTION header');
  it('should deny request with invalid MFA token');
  it('should allow request with valid MFA token');
  it('should verify MFA token signature');
});
```

**Estimated Effort**: 3 days

---

### P0-002: Add DB Role Separation for Ledger Posting
**Status**: MIGRATION_NEEDED  
**Description**: Create separate DB roles (app_reader, app_writer, ledger_poster) to enforce that app code cannot directly INSERT into journal tables.

**Acceptance Criteria**:
- [ ] Migration creates roles: app_reader, app_writer, ledger_poster
- [ ] ledger_poster role has EXECUTE on ledger_post_entry() only
- [ ] app_writer role has INSERT/UPDATE/DELETE on all tables EXCEPT journal_entries/journal_lines
- [ ] CI verifies app user has no INSERT on journal tables
- [ ] Test: direct INSERT into journal_entries raises permission denied

**Migration**:
```sql
-- migrations/005_ledger_roles.up.sql
CREATE ROLE app_reader;
CREATE ROLE app_writer;
CREATE ROLE ledger_poster;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_writer;
REVOKE INSERT, UPDATE, DELETE ON journal_entries FROM app_writer;
REVOKE INSERT, UPDATE, DELETE ON journal_lines FROM app_writer;
GRANT EXECUTE ON FUNCTION ledger_post_entry TO ledger_poster;
```

**Tests Required**:
```bash
# CI check
psql -c "SELECT has_table_privilege('app_writer', 'journal_entries', 'INSERT');" 
# Should return 'f' (false)
```

**Estimated Effort**: 1 day

---

### P0-003: Implement Inbox Dedup Atomicity
**Status**: RACE_CONDITION_RISK  
**Description**: Current inbox dedup in workers has race condition: SELECT + INSERT is not atomic. Use INSERT ... ON CONFLICT to guarantee exactly-once.

**Acceptance Criteria**:
- [ ] Replace SELECT + INSERT with INSERT ... ON CONFLICT DO NOTHING
- [ ] Return early if INSERT affected 0 rows (duplicate)
- [ ] Integration test: parallel message processing doesn't duplicate
- [ ] Property test: N identical messages => 1 processing

**Fix**:
```typescript
// apps/workers/src/balance-projection.ts
const result = await query(
  `INSERT INTO inbox_events (message_id, consumer_group) 
   VALUES ($1, $2) 
   ON CONFLICT (message_id, consumer_group) DO NOTHING 
   RETURNING id`,
  [messageId, this.CONSUMER_GROUP],
  client
);
if (!result || result.rowCount === 0) {
  logger.info({ messageId }, 'Duplicate message, skipping');
  return;
}
// Process message...
```

**Tests Required**:
```typescript
describe('Inbox dedup', () => {
  it('should process message exactly once even with concurrent deliveries');
  it('should skip duplicate message_id');
});
```

**Estimated Effort**: 1 day

---

### P0-004: Add Canonical JSON Serialization for Determinism
**Status**: MISSING  
**Description**: Create canonical JSON serializer for idempotency key hashing, audit hash chain, and event payload hashing.

**Acceptance Criteria**:
- [ ] Implement canonicalJSON() with stable key ordering
- [ ] Stable decimal format for amounts (no scientific notation)
- [ ] Stable date format (ISO 8601 / RFC3339)
- [ ] Use in idempotency middleware for request hashing
- [ ] Use in audit hash chain computation
- [ ] Property test: same input => same hash

**Implementation**:
```typescript
// packages/crypto/src/canonical-json.ts
export function canonicalJSON(obj: unknown): string {
  if (obj === null) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number') return String(obj); // no scientific
  if (typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => `${JSON.stringify(k)}:${canonicalJSON((obj as any)[k])}`);
    return '{' + pairs.join(',') + '}';
  }
  throw new Error('Unsupported type');
}
```

**Tests Required**:
```typescript
it('should produce stable output for same input');
it('should sort object keys');
it('should format amounts without scientific notation');
it('property test: hash(canonical(a)) === hash(canonical(a))');
```

**Estimated Effort**: 2 days

---

## Priority 1 (HIGH - Must Fix Soon)

### P1-001: Add Event Schema Validation
**Status**: SCHEMAS_EXIST  
**Description**: Event schemas exist in events/schemas/ but no runtime validation. Add Ajv validator to packages/events.

**Acceptance Criteria**:
- [ ] Install ajv + ajv-formats
- [ ] Load schemas from events/schemas/ directory
- [ ] Validate payload before publishing to outbox
- [ ] Validate payload before processing in consumers
- [ ] CI fails if event doesn't match schema
- [ ] Add schema version to envelope

**Implementation**:
```typescript
// packages/events/src/schema-validator.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const ajv = new Ajv();
addFormats(ajv);

const schemasDir = path.join(__dirname, '../../events/schemas');
const schemas: Record<string, any> = {};

// Load all schemas
fs.readdirSync(schemasDir).forEach(file => {
  const schemaPath = path.join(schemasDir, file);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  schemas[file.replace('.json', '')] = ajv.compile(schema);
});

export function validateEventPayload(eventType: string, payload: unknown): void {
  const schemaKey = eventType.replace(/\./g, '.').toLowerCase();
  const validate = schemas[schemaKey];
  if (!validate) {
    throw new Error(`No schema found for event type: ${eventType}`);
  }
  if (!validate(payload)) {
    throw new Error(`Schema validation failed: ${ajv.errorsText(validate.errors)}`);
  }
}
```

**Tests Required**:
```typescript
it('should validate ledger.posted.v1 payload');
it('should reject invalid payload');
it('should throw on unknown event type');
```

**Estimated Effort**: 2 days

---

### P1-002: Implement PII Automatic Redaction Filters
**Status**: MANUAL_REDACTION_ONLY  
**Description**: PII registry exists but no automatic filters. Must intercept logs/webhooks/audit to redact PII.

**Acceptance Criteria**:
- [ ] Logging filter integrated with pino
- [ ] Audit payload sanitizer before insert
- [ ] Webhook payload filter (allowlist approach)
- [ ] Elasticsearch indexer never indexes raw PII
- [ ] CI test scans test logs for PII leaks

**Implementation**:
```typescript
// packages/observability/src/pii-filter.ts
import pino from 'pino';
import { redactPII } from './pii';

export function createLoggerWithPiiFilter(opts: any) {
  return pino({
    ...opts,
    serializers: {
      ...opts.serializers,
      req: (req: any) => {
        const base = pino.stdSerializers.req(req);
        return redactPII(base);
      },
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: ['*.national_id', '*.passport_number', '*.pin', '*.pin_hash'],
      censor: '[REDACTED]',
    },
  });
}
```

**Tests Required**:
```typescript
it('should redact PII from log payloads');
it('should detect PII leak in test logs');
```

**Estimated Effort**: 2 days

---

### P1-003: Add Obligation Registry Validation to CI
**Status**: FILE_EXISTS_NO_VALIDATION  
**Description**: Obligation registry exists but no CI check that policy YAML obligations match registry.

**Acceptance Criteria**:
- [ ] CI script parses all policy YAML files
- [ ] Extracts all obligations referenced
- [ ] Checks each obligation exists in registry.json
- [ ] Fails if unknown obligation found
- [ ] Fails if obligation params don't match schema

**Implementation**:
```bash
# .github/workflows/ci.yml
- name: Validate policy obligations
  run: node scripts/validate-obligations.js
```

```typescript
// scripts/validate-obligations.ts
import * as yaml from 'js-yaml';
import * as fs from 'fs';
const registry = JSON.parse(fs.readFileSync('policies/obligations/registry.json', 'utf-8'));
const policies = fs.readdirSync('policies').filter(f => f.endsWith('.yaml'));
for (const file of policies) {
  const policy = yaml.load(fs.readFileSync(`policies/${file}`, 'utf-8')) as any;
  for (const rule of policy.rules) {
    if (rule.obligations) {
      for (const obl of rule.obligations) {
        if (!registry.obligations[obl]) {
          throw new Error(`Unknown obligation: ${obl} in ${file}`);
        }
      }
    }
  }
}
```

**Estimated Effort**: 1 day

---

### P1-004: Implement Break-Glass Mechanism
**Status**: STUB  
**Description**: governance.require_break_glass obligation exists in registry but no implementation.

**Acceptance Criteria**:
- [ ] Break-glass requests stored in break_glass_sessions table
- [ ] Requires X-TICKET-REF and X-BREAK-GLASS-ASSERTION
- [ ] Auto-expires after max_duration_seconds
- [ ] Creates CRITICAL audit entry
- [ ] Sends alert event to monitoring
- [ ] Policy test: break-glass allows otherwise denied action

**Migration**:
```sql
CREATE TABLE break_glass_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  ticket_ref VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);
```

**Tests Required**:
```typescript
it('should allow break-glass with valid ticket');
it('should deny break-glass without ticket');
it('should auto-expire break-glass session');
it('should create CRITICAL audit entry');
```

**Estimated Effort**: 3 days

---

### P1-005: Add Migration Regression Tests
**Status**: MANUAL_VERIFICATION  
**Description**: Migrations exist but no automated tests that verify schema constraints.

**Acceptance Criteria**:
- [ ] Test: direct INSERT into journal_entries raises exception
- [ ] Test: direct UPDATE on journal_entries raises exception
- [ ] Test: ledger_post_entry() enforces debits=credits
- [ ] Test: ledger_post_entry() enforces currency consistency
- [ ] Test: ledger_post_entry() is idempotent
- [ ] Test: audit_events triggers enforce hash chain

**Implementation**:
```typescript
// packages/db/src/migration.test.ts
describe('Migration 002: Ledger Guardrails', () => {
  it('should prevent direct INSERT into journal_entries', async () => {
    await expect(
      query('INSERT INTO journal_entries (id, subledger, description, reference, correlation_id, idempotency_key, business_day, metadata, entry_hash) VALUES (uuid_generate_v4(), \'CUSTOMER\', \'test\', \'ref\', uuid_generate_v4(), \'key\', \'2024-01-01\', \'{}\', \'hash\')')
    ).rejects.toThrow('Ledger tables are immutable');
  });
  
  it('should enforce debits=credits in ledger_post_entry', async () => {
    const lines = [
      { accountId: accountA, debitCredit: 'DEBIT', amount: '100.00', currencyCode: 'BBD' },
      { accountId: accountB, debitCredit: 'CREDIT', amount: '99.00', currencyCode: 'BBD' },
    ];
    await expect(
      query('SELECT * FROM ledger_post_entry($1, $2, $3, $4, $5, $6, $7, $8, $9)', [
        'CUSTOMER', 'test', 'ref', uuid(), 'idem-key', '2024-01-01', '{}', JSON.stringify(lines), null
      ])
    ).rejects.toThrow('Debits must equal credits');
  });
});
```

**Estimated Effort**: 2 days

---

## Priority 2 (MEDIUM - Plan for Next Sprint)

### P2-001: Add Business Day Clock Abstraction
**Status**: HARDCODED_NOW  
**Description**: Business day currently uses NOW() in migrations but should be configurable with timezone + cutoff.

**Estimated Effort**: 3 days

### P2-002: Implement Limits Engine
**Status**: PLACEHOLDER  
**Description**: finance.require_limit_not_exceeded obligation exists but no limits checking.

**Estimated Effort**: 5 days

### P2-003: Add Velocity Checks
**Status**: PLACEHOLDER  
**Description**: risk.require_velocity_check obligation exists but no implementation.

**Estimated Effort**: 3 days

### P2-004: Implement Settlement Calendar
**Status**: MISSING  
**Description**: Need holiday calendar and settlement window enforcement.

**Estimated Effort**: 4 days

### P2-005: Add Partitioning for journal_lines
**Status**: DESIGN_ONLY  
**Description**: Design exists in migration comments but not implemented. Partition by business_day (monthly).

**Estimated Effort**: 2 days

---

## Summary

- **P0 Items**: 4 (must fix immediately)
- **P1 Items**: 5 (must fix soon)
- **P2 Items**: 5 (plan for next sprint)

**Total Estimated Effort**: 
- P0: 7 days
- P1: 10 days
- P2: 17 days

**Recommended Sprint Planning**:
- Sprint 1 (Week 1-2): P0-001, P0-002, P0-003, P0-004
- Sprint 2 (Week 3-4): P1-001, P1-002, P1-003, P1-004, P1-005
- Sprint 3 (Week 5-6): P2 items
