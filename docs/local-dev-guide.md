# Caricash Local Development Guide

## Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker and Docker Compose

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> && cd caricash

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies
pnpm install

# 4. Start infrastructure
docker compose up -d

# 5. Run database migrations
pnpm migrate

# 6. Build all packages
pnpm build

# 7. Run tests
pnpm test

# 8. Start development servers
pnpm dev
```

## Services

| Service | URL | Credentials |
|---------|-----|-------------|
| PostgreSQL | localhost:5432 | caricash/caricash_dev |
| Redis | localhost:6379 | - |
| RabbitMQ | localhost:5672 | guest/guest |
| RabbitMQ Management | localhost:15672 | guest/guest |
| Elasticsearch | localhost:9200 | - |
| API Gateway | localhost:3000 | - |
| Admin API | localhost:3001 | - |

## Running Specific Tests
```bash
# All tests
pnpm test

# Specific package
cd packages/common && pnpm test

# Watch mode
cd packages/crypto && npx jest --watch
```

## Database Migrations
```bash
# Apply migrations
pnpm migrate

# Migrations are in the /migrations directory
# Format: NNN_name.up.sql / NNN_name.down.sql
```

## Project Structure
```
caricash/
├── apps/
│   ├── api-gateway/     # Public API (NestJS)
│   ├── admin-api/       # Staff API (NestJS)
│   ├── workers/         # Background workers
│   └── web-console/     # React admin dashboard
├── packages/
│   ├── db/              # Database layer
│   ├── common/          # Shared types & utilities
│   ├── events/          # Event contracts
│   ├── crypto/          # Cryptographic utilities
│   ├── observability/   # Logging & metrics
│   └── policy/          # RBAC policy engine
├── migrations/          # SQL migration files
├── policies/            # RBAC policy YAML files
├── docs/                # Documentation
└── docker-compose.yml   # Local infrastructure
```
