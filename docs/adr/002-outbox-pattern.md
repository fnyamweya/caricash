# ADR-002: Transactional Outbox Pattern

## Status
Accepted

## Context
We need reliable event publishing that guarantees:
1. If business data is committed, the event is eventually published
2. If business data is rolled back, no event is published
3. Events are published at least once (with consumer dedup)

## Decision
Use the transactional outbox pattern:
1. Write business data + outbox_events row in the same DB transaction
2. Outbox publisher worker polls outbox_events and publishes to RabbitMQ
3. Publisher marks events as PUBLISHED after successful publish
4. Retries with exponential backoff on failure

Combined with inbox dedup on consumers:
1. Every consumer checks inbox_events before processing
2. message_id + consumer_group is unique key
3. Ensures exactly-once processing semantics

## Consequences
- Slightly increased latency (polling interval)
- Need for background worker process
- Guaranteed consistency between data and events
- Consumers must be idempotent
