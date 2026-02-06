# Phase 4 Specification: Settlement, Maker-Checker, EOD & Reconciliation

## Overview
Phase 4 implements settlement cycles, approval workflows, end-of-day processing, and reconciliation.

## Scope
- **Settlement engine**: Periodic merchant/agent settlement with fee deductions
- **Maker-checker**: Protected command pattern with dual approval
- **Holds & disputes**: Place holds, chargeback handling
- **EOD processing**: Business day close, reporting
- **Reconciliation**: External system matching

## Architecture
- Settlement runs compute net positions
- Approval requests stored as protected commands
- Holds block available balance
- EOD closes business day and generates reports
- Reconciliation engine matches external records

## Database Schema
See `migrations/004_phase4.up.sql`

## API Endpoints
- `POST /api/v1/settlements/runs` - Trigger settlement
- `POST /api/v1/approvals/requests` - Create approval request
- `POST /api/v1/approvals/:id/decide` - Approve/reject
- `POST /api/v1/holds` - Place hold
- `POST /api/v1/eod/close` - Close business day
- `POST /api/v1/reconciliation/runs` - Start recon

## Event Contracts
- `settlement.created.v1`
- `settlement.paid.v1`
- `approval.requested.v1`
- `approval.decided.v1`
- `hold.placed.v1`
- `day.closed.v1`
- `reconciliation.completed.v1`

## Acceptance Criteria
- [ ] Settlement calculates net correctly
- [ ] Maker-checker enforces dual approval
- [ ] Holds prevent overdraft
- [ ] EOD locks business day
- [ ] Reconciliation detects exceptions
- [ ] Break-glass audited

## Stop-the-Line Checks
- Settlement must post via stored procedure
- Maker-checker obligations enforced
- Break-glass requires ticket + auto-expiry
- EOD must verify debits=credits
