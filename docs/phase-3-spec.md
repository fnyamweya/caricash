# Phase 3 Specification: Payments, Pricing, Webhooks & Notifications

## Overview
Phase 3 implements transaction orchestration, fee/commission engine, webhook delivery, and notification outbox.

## Scope
- **Payment state machine**: INITIATED → AUTHORIZED → LEDGER_POSTED → NOTIFIED → COMPLETED
- **Pricing engine**: Configurable fee/commission rules with tiered pricing
- **CoS (Chart of Services)**: Multi-output memo+ledger instruction generation
- **Webhook delivery**: Reliable HTTP delivery with retries and DLQ
- **Notification outbox**: SMS/Email/Push queueing

## Architecture
- Payment orchestrator coordinates state transitions
- Pricing rules stored in DB with version control
- CoS templates define account mappings for each payment type
- Webhook subscriptions with signature verification
- Notification jobs with template rendering

## Database Schema
See `migrations/003_phase3.up.sql`

## API Endpoints
- `POST /api/v1/payments` - Initiate payment
- `GET /api/v1/payments/:id` - Get payment status
- `POST /api/v1/pricing/quote` - Get pricing quote
- `POST /api/v1/webhooks/subscriptions` - Create webhook subscription
- `GET /api/v1/webhooks/deliveries` - List webhook deliveries

## Event Contracts
- `payment.initiated.v1`
- `payment.completed.v1`
- `payment.failed.v1`
- `pricing.quote_created.v1`
- `webhook.delivered.v1`
- `notification.sent.v1`

## Acceptance Criteria
- [ ] Payment state machine enforces valid transitions
- [ ] Pricing engine calculates fees deterministically
- [ ] CoS engine generates correct ledger postings
- [ ] Webhooks deliver with signature verification
- [ ] Notifications queue and retry on failure
- [ ] All transitions audited
- [ ] Idempotency enforced on payment initiation

## Stop-the-Line Checks
- Payment ledger posting must use stored procedure
- Pricing must be locked before posting
- Webhook signatures must be verified
- No PII in webhook payloads
