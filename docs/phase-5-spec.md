# Phase 5 Specification: Multi-Country, FX, Risk & Advanced Features

## Overview
Phase 5 extends platform for multi-country operations, foreign exchange, risk engine, and advanced controls.

## Scope
- **Multi-country**: Country-specific KYC, policy, limits
- **FX engine**: Exchange rate locking, cross-currency transactions
- **Risk scoring**: ML-based risk assessment
- **Limits engine**: Per-user, per-tier, per-channel velocity
- **Sanctions screening**: PEP/sanctions list integration
- **Data retention**: Configurable retention policies
- **Tenant isolation**: Multi-tenant architecture (if needed)

## Architecture
- Country-scoped configurations
- FX rate locking with expiry
- Risk engine streams events for ML scoring
- Limits checked pre-transaction
- Sanctions check before KYC approval
- Retention policies enforced via scheduled jobs

## Database Schema
- TBD (Phase 5 migration)

## API Endpoints
- TBD

## Event Contracts
- `fx.rate_locked.v1`
- `risk.score_updated.v1`
- `sanctions.check_completed.v1`
- `limit.exceeded.v1`

## Acceptance Criteria
- [ ] Multi-country KYC requirements enforced
- [ ] FX rates locked per transaction
- [ ] Risk scores computed and stored
- [ ] Limits enforced at transaction time
- [ ] Sanctions checks integrated
- [ ] Data retention applied

## Stop-the-Line Checks
- FX rate must be locked before posting
- Sanctions check mandatory for high-risk
- Limits enforced via policy obligations
- Multi-country configs versioned
