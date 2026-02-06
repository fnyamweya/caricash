# Caricash Phase 1 Runbook

## Common Operations

### Verify Audit Chain Integrity
```bash
# Via admin API
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/audit/verify
```

### Check Outbox Backlog
```sql
SELECT status, COUNT(*) FROM outbox_events GROUP BY status;
SELECT * FROM outbox_events WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 10;
```

### Check Consumer Lag
```sql
-- Unprocessed outbox events
SELECT COUNT(*) FROM outbox_events WHERE status = 'PENDING';

-- Recent inbox processing
SELECT consumer_group, COUNT(*), MAX(processed_at) as last_processed
FROM inbox_events
GROUP BY consumer_group;
```

### Ledger Balance Verification
```sql
-- Verify debits = credits for all entries
SELECT je.id, je.idempotency_key,
  SUM(CASE WHEN jl.debit_credit = 'DEBIT' THEN jl.amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN jl.debit_credit = 'CREDIT' THEN jl.amount ELSE 0 END) as total_credits
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
GROUP BY je.id, je.idempotency_key
HAVING SUM(CASE WHEN jl.debit_credit = 'DEBIT' THEN jl.amount ELSE 0 END) !=
       SUM(CASE WHEN jl.debit_credit = 'CREDIT' THEN jl.amount ELSE 0 END);
-- Should return 0 rows
```

### Compare Projection vs Truth
```sql
-- Compute actual balance from journal lines
SELECT jl.account_id, jl.currency_code,
  SUM(CASE WHEN jl.debit_credit = 'CREDIT' THEN jl.amount ELSE -jl.amount END) as computed_balance
FROM journal_lines jl
JOIN journal_entries je ON je.id = jl.entry_id
WHERE je.status = 'POSTED'
GROUP BY jl.account_id, jl.currency_code;

-- Compare with projection
SELECT abp.account_id, abp.posted_balance, abp.currency_code
FROM account_balance_projections abp;
```

## Incident Response

### Outbox Publisher Stuck
1. Check worker logs for errors
2. Check RabbitMQ connectivity: `docker compose exec rabbitmq rabbitmq-diagnostics check_running`
3. Check failed events: `SELECT * FROM outbox_events WHERE status = 'FAILED'`
4. Restart workers: `docker compose restart workers` (when available)

### Audit Chain Broken
1. Run verification: `curl http://localhost:3001/api/v1/audit/verify`
2. If `brokenAt` is reported, investigate the event at that sequence number
3. Check for unauthorized DB access in PostgreSQL logs
4. **This is a security incident** - escalate immediately
