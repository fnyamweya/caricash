# ADR-004: Tamper-Evident Audit Hash Chain

## Status
Accepted

## Context
Regulatory compliance requires tamper-evident audit trails. If an audit record is modified, it should be detectable.

## Decision
Use a global hash chain on audit_events:
- Each event: hash = SHA256(prev_hash + canonical_json(fields))
- prev_hash references the hash of the immediately preceding event
- Verification tool reads entire chain and validates each link
- Global chain chosen over per-tenant for Phase 1 simplicity

## Consequences
- Write serialization needed (advisory lock) for chain integrity
- Verification is O(n) over all events
- Tampering of any event breaks the chain for all subsequent events
- In Phase 2, consider per-tenant chains for scalability
