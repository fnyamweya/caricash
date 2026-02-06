import { Injectable } from '@nestjs/common';
import { query, queryOne, queryMany } from '@caricash/db';
import type { TransactionClient } from '@caricash/db';
import { PostingLine } from '@caricash/common';

@Injectable()
export class LedgerRepository {
  async findByIdempotencyKey(key: string, client: TransactionClient) {
    return queryOne(
      `SELECT je.*, array_agg(json_build_object(
        'id', jl.id, 'account_id', jl.account_id, 'debit_credit', jl.debit_credit,
        'amount', jl.amount, 'currency_code', jl.currency_code, 'line_number', jl.line_number
      )) as lines
      FROM journal_entries je
      LEFT JOIN journal_lines jl ON jl.entry_id = je.id
      WHERE je.idempotency_key = $1
      GROUP BY je.id`,
      [key],
      client,
    );
  }

  async findEntryById(id: string, client: TransactionClient) {
    return queryOne<{
      id: string; subledger: string; status: string; description: string;
      correlation_id: string; business_day: string;
    }>(
      'SELECT * FROM journal_entries WHERE id = $1',
      [id],
      client,
    );
  }

  async findLinesByEntryId(entryId: string, client: TransactionClient) {
    return queryMany<{
      id: string; account_id: string; debit_credit: string;
      amount: string; currency_code: string; line_number: number;
    }>(
      'SELECT * FROM journal_lines WHERE entry_id = $1 ORDER BY line_number',
      [entryId],
      client,
    );
  }

  async createJournalEntry(
    request: {
      subledger: string; description: string; correlationId: string;
      idempotencyKey: string; businessDay: string; metadata?: Record<string, unknown>;
    },
    client: TransactionClient,
  ) {
    return queryOne<{ id: string; entry_number: number; status: string; created_at: Date }>(
      `INSERT INTO journal_entries (subledger, description, correlation_id, idempotency_key, business_day, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, entry_number, status, created_at`,
      [
        request.subledger,
        request.description,
        request.correlationId,
        request.idempotencyKey,
        request.businessDay,
        JSON.stringify(request.metadata ?? {}),
      ],
      client,
    ) as Promise<{ id: string; entry_number: number; status: string; created_at: Date }>;
  }

  async createReversalEntry(
    request: {
      subledger: string; description: string; correlationId: string;
      idempotencyKey: string; businessDay: string; reversedEntryId: string;
    },
    client: TransactionClient,
  ) {
    return queryOne<{ id: string; entry_number: number; status: string; created_at: Date }>(
      `INSERT INTO journal_entries (subledger, description, correlation_id, idempotency_key, business_day, reversed_entry_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, '{}')
       RETURNING id, entry_number, status, created_at`,
      [
        request.subledger,
        request.description,
        request.correlationId,
        request.idempotencyKey,
        request.businessDay,
        request.reversedEntryId,
      ],
      client,
    ) as Promise<{ id: string; entry_number: number; status: string; created_at: Date }>;
  }

  async createJournalLines(
    entryId: string,
    lines: PostingLine[],
    client: TransactionClient,
  ) {
    const results = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const row = await queryOne(
        `INSERT INTO journal_lines (entry_id, account_id, debit_credit, amount, currency_code, line_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [entryId, line.accountId, line.debitCredit, line.amount, line.currencyCode, i + 1],
        client,
      );
      results.push(row);
    }
    return results;
  }

  async markEntryReversed(entryId: string, client: TransactionClient) {
    await query(
      `UPDATE journal_entries SET status = 'REVERSED' WHERE id = $1`,
      [entryId],
      client,
    );
  }

  async createOutboxEvent(
    eventType: string,
    correlationId: string,
    payload: unknown,
    client: TransactionClient,
  ) {
    await query(
      `INSERT INTO outbox_events (event_type, correlation_id, payload)
       VALUES ($1, $2, $3)`,
      [eventType, correlationId, JSON.stringify(payload)],
      client,
    );
  }

  async getStatementLines(accountId: string, cursor: string | undefined, limit: number) {
    let rows;
    if (cursor) {
      rows = await queryMany(
        `SELECT jl.*, je.description, je.correlation_id, je.business_day, je.status as entry_status
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.account_id = $1 AND jl.created_at < $2
         ORDER BY jl.created_at DESC
         LIMIT $3`,
        [accountId, cursor, limit + 1],
      );
    } else {
      rows = await queryMany(
        `SELECT jl.*, je.description, je.correlation_id, je.business_day, je.status as entry_status
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.entry_id
         WHERE jl.account_id = $1
         ORDER BY jl.created_at DESC
         LIMIT $2`,
        [accountId, limit + 1],
      );
    }

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].created_at : undefined;

    return { data, nextCursor, hasMore };
  }
}
