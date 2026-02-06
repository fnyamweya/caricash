# Caricash

Fintech platform for Barbados — Phase 1: Foundations, Security, Core Ledger, Audit & Eventing.

## Architecture

- **Monorepo**: pnpm workspaces with NestJS + PostgreSQL + Redis + RabbitMQ + Elasticsearch
- **No ORM**: Direct SQL with node-postgres, parameterized queries, explicit transactions
- **Double-entry ledger**: Immutable journal entries, corrections via reversals only
- **Outbox pattern**: Reliable event publishing with inbox dedup for exactly-once processing
- **Audit trail**: Append-only with tamper-evident SHA-256 hash chain

## Quick Start

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9, Docker

cp .env.example .env
pnpm install
docker compose up -d
pnpm build
pnpm migrate
pnpm test
```

## Project Structure

```
caricash/
├── apps/
│   ├── api-gateway/     # Public API: auth, ledger queries (port 3000)
│   ├── admin-api/       # Staff API: audit, config (port 3001)
│   ├── workers/         # Outbox publisher, balance projection, audit indexer
│   └── web-console/     # React admin dashboard scaffold
├── packages/
│   ├── db/              # pg pool, tx helper, migration runner
│   ├── common/          # Types, errors, constants
│   ├── events/          # Event envelope, contracts
│   ├── crypto/          # PIN hashing (argon2id), audit hash chain
│   ├── observability/   # Structured logging (pino)
│   └── policy/          # RBAC policy engine
├── migrations/          # SQL migration files
├── policies/            # RBAC policy YAML files
└── docs/                # Specs, ADRs, threat model, runbooks
```

## Key Design Decisions

| ADR | Decision |
|-----|----------|
| [001](docs/adr/001-no-orm.md) | No ORM — direct SQL with node-postgres |
| [002](docs/adr/002-outbox-pattern.md) | Transactional outbox pattern |
| [003](docs/adr/003-immutable-ledger.md) | Immutable double-entry ledger |
| [004](docs/adr/004-audit-hash-chain.md) | Tamper-evident audit hash chain |

## Documentation

- [Phase 1 Specification](docs/phase-1-spec.md)
- [Threat Model](docs/threat-model.md)
- [Local Dev Guide](docs/local-dev-guide.md)
- [Runbook](docs/runbook.md)

## License

See [LICENSE](LICENSE).