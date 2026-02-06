# ADR-003: Immutable Double-Entry Ledger

## Status
Accepted

## Context
A financial ledger must be the canonical source of truth for all monetary balances. It must be:
- Immutable: entries cannot be modified or deleted
- Balanced: every entry's debits must equal credits
- Auditable: complete history of all changes
- Correctable: errors fixed via reversal entries only

## Decision
- journal_entries and journal_lines are append-only
- No UPDATE or DELETE on these tables at application level
- Corrections made via new reversal entries that reference the original
- Balance is computed from journal_lines (truth), not from projections
- account_balance_projections updated async by worker, clearly documented as NOT truth

## Consequences
- Storage grows monotonically
- Correction requires new entry (more data, but complete history)
- Balance queries over full history may be slow → use projection for reads
- Projection consistency lag acceptable for non-critical reads
