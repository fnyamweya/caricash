# Caricash Phase 1: Foundations Specification

## Overview
Phase 1 establishes the foundational architecture for the Caricash Barbados fintech platform. It delivers a working monorepo with core financial primitives, security controls, and operational tooling.

## Architecture
- **Monorepo**: pnpm workspaces with apps/ and packages/
- **Backend**: NestJS (TypeScript), no ORM, node-postgres with prepared statements
- **Database**: PostgreSQL 16 (canonical source of truth)
- **Messaging**: RabbitMQ (async events via outbox pattern)
- **Cache**: Redis (rate limiting, sessions)
- **Search**: Elasticsearch (audit indexing, NOT system of record)
- **Frontend**: React admin console scaffold

## Core Principles
1. **Ledger is truth**: Double-entry, immutable postings, corrections via reversals only
2. **No ORM**: Direct SQL with parameterized queries
3. **Idempotency**: Every financial POST requires Idempotency-Key header
4. **Outbox pattern**: Business data + event in same DB transaction
5. **Inbox dedup**: Every consumer checks dedup before processing
6. **Audit chain**: Append-only with tamper-evident SHA-256 hash chain
7. **API versioning**: /api/v1 prefix on all endpoints

## Apps
| App | Port | Purpose |
|-----|------|---------|
| api-gateway | 3000 | Public APIs (auth, ledger queries) |
| admin-api | 3001 | Staff endpoints (audit, config) |
| workers | N/A | Outbox publisher, balance projection, audit indexer |
| web-console | 5173 | React admin dashboard |

## Packages
| Package | Purpose |
|---------|---------|
| @caricash/db | PostgreSQL pool, transactions, migrations |
| @caricash/common | Types, errors, constants, correlation IDs |
| @caricash/events | Event envelope, types, contracts |
| @caricash/crypto | PIN hashing (argon2id), audit hash chain |
| @caricash/observability | Structured logging (pino) |
| @caricash/policy | RBAC policy engine (Cerbos-style) |

## Database Schema (Phase 1)
### Tables
- countries, currencies, country_currencies (config)
- principals, refresh_tokens, roles, principal_roles (identity)
- ledger_accounts, journal_entries, journal_lines (ledger)
- account_balance_projections (async projection)
- idempotency_keys (request dedup)
- outbox_events, inbox_events (eventing)
- audit_events (tamper-evident audit trail)
- rate_limit_events (security metadata)

### Key Constraints
- journal_entries.idempotency_key: UNIQUE
- journal_lines.amount: CHECK > 0
- journal_lines.(entry_id, line_number): UNIQUE
- audit_events: append-only, no UPDATE/DELETE at application level

## Event Contracts
| Event | Description |
|-------|-------------|
| Ledger.Posted.v1 | Journal entry posted |
| Ledger.Reversed.v1 | Journal entry reversed |
| Audit.Recorded.v1 | Audit event recorded |
| Identity.PrincipalCreated.v1 | New principal created |
| Identity.Login.v1 | Successful login |

## Ledger Account Code Format
`{OWNER_TYPE_PREFIX}-{UUID}-{CURRENCY}-{ACCOUNT_TYPE}`
Example: `CUST-550e8400-BBD-WALLET`

## Security Controls
- PIN: argon2id with 64MB memory, 3 iterations, 4 parallelism
- JWT: access (15min) + refresh (7 days) token pair
- Rate limiting: Redis-based, 5 PIN attempts before 30-min lockout
- Headers: helmet (HSTS, CSP, X-Content-Type-Options)
- Correlation: X-Correlation-ID and X-Request-ID on every request
- Staff auth: OAuth bearer token (mock introspection in Phase 1)

## Acceptance Criteria
1. ✅ Docker compose starts all services
2. ✅ Migrations apply cleanly to empty database
3. ✅ Health endpoints respond on both api-gateway and admin-api
4. ✅ All 65+ unit tests pass
5. ✅ Ledger invariant property tests verify debits=credits
6. ✅ Audit hash chain is verifiable
7. ✅ Policy engine correctly evaluates RBAC rules
8. ✅ PIN hashing uses argon2id
