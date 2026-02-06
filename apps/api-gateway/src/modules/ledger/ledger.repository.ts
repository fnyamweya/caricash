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

  async findReversalByEntryId(entryId: string, client: TransactionClient) {
    return queryOne<{ id: string }>(
      'SELECT id FROM journal_entries WHERE reversed_entry_id = $1 LIMIT 1',
      [entryId],
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

  async postEntryViaProcedure(
    request: {
      subledger: string; description: string; reference: string; correlationId: string;
      idempotencyKey: string; businessDay: string; metadata?: Record<string, unknown>; lines: PostingLine[]; reversedEntryId?: string | null;
    },
    client: TransactionClient,
  ) {
    await queryOne(
      `SELECT * FROM ledger_post_entry($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        request.subledger,
        request.description,
        request.reference,
        request.correlationId,
        request.idempotencyKey,
        request.businessDay,
        JSON.stringify(request.metadata ?? {}),
        JSON.stringify(request.lines),
        request.reversedEntryId ?? null,
      ],
      client,
    );

    return this.findByIdempotencyKey(request.idempotencyKey, client);
  }

  /**
   * DEPRECATED: Direct journal_entries INSERT is forbidden.
   * Use postEntryViaProcedure() which calls ledger_post_entry() stored procedure.
   */
  private async createJournalEntry_DEPRECATED_DO_NOT_USE(
    request: {
      subledger: string; description: string; correlationId: string;
      idempotencyKey: string; businessDay: string; metadata?: Record<string, unknown>;
      reference: string; entryHash: string; id?: string;
    },
    client: TransactionClient,
  ) {
    throw new Error('STOP: Direct journal_entries INSERT is forbidden. Use ledger_post_entry() stored procedure.');
  }

  /**
   * DEPRECATED: Direct journal_entries INSERT for reversals is forbidden.
   * Use postEntryViaProcedure() with reversedEntryId parameter instead.
   */
  private async createReversalEntry_DEPRECATED_DO_NOT_USE(
    request: {
      subledger: string; description: string; correlationId: string;
      idempotencyKey: string; businessDay: string; reversedEntryId: string; reference: string; entryHash: string; id?: string;
    },
    client: TransactionClient,
  ) {
    throw new Error('STOP: Direct journal_entries INSERT is forbidden. Use ledger_post_entry() stored procedure.');
  }

  /**
   * DEPRECATED: Direct journal_lines INSERT is forbidden.
   * Use postEntryViaProcedure() which calls ledger_post_entry() stored procedure.
   */
  private async createJournalLines_DEPRECATED_DO_NOT_USE(
    entryId: string,
    lines: PostingLine[],
    client: TransactionClient,
  ) {
    throw new Error('STOP: Direct journal_lines INSERT is forbidden. Use ledger_post_entry() stored procedure.');
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
