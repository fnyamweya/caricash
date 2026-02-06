import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { withTransaction } from '@caricash/db';
import { PostingRequest, ValidationError, ConflictError, NotFoundError, PaginationParams } from '@caricash/common';
import { EventTypes } from '@caricash/events';

@Injectable()
export class LedgerService {
  constructor(private readonly repo: LedgerRepository) {}

  async postEntry(request: PostingRequest) {
    // Validate lines
    if (!request.lines || request.lines.length < 2) {
      throw new ValidationError('A journal entry must have at least 2 lines');
    }

    // Validate debits = credits per currency
    const totals = new Map<string, { debits: number; credits: number }>();
    for (const line of request.lines) {
      const amount = Number(line.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new ValidationError(`Invalid amount: ${line.amount}`);
      }
      const curr = totals.get(line.currencyCode) ?? { debits: 0, credits: 0 };
      if (line.debitCredit === 'DEBIT') {
        curr.debits += amount;
      } else {
        curr.credits += amount;
      }
      totals.set(line.currencyCode, curr);
    }

    for (const [currency, { debits, credits }] of totals) {
      // Use epsilon comparison for floating point
      if (Math.abs(debits - credits) > 0.00000001) {
        throw new ValidationError(
          `Debits (${debits}) must equal credits (${credits}) for currency ${currency}`,
        );
      }
    }

    // All currencies on lines must match
    const currencies = new Set(request.lines.map((l) => l.currencyCode));
    if (currencies.size > 1) {
      throw new ValidationError('All lines in an entry must use the same currency');
    }

    return withTransaction(async (client) => {
      // Check idempotency
      const existing = await this.repo.findByIdempotencyKey(request.idempotencyKey, client);
      if (existing) {
        return existing;
      }

      // Create journal entry + lines + outbox event atomically
      const entry = await this.repo.createJournalEntry(request, client);
      const lines = await this.repo.createJournalLines(entry.id, request.lines, client);

      // Write outbox event in same transaction
      await this.repo.createOutboxEvent(
        EventTypes.LEDGER_POSTED,
        request.correlationId,
        {
          entryId: entry.id,
          entryNumber: entry.entry_number,
          subledger: request.subledger,
          description: request.description,
          businessDay: request.businessDay,
          idempotencyKey: request.idempotencyKey,
          lines: request.lines,
          metadata: request.metadata ?? {},
        },
        client,
      );

      return { ...entry, lines };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  async reverseEntry(
    entryId: string,
    params: { idempotencyKey: string; correlationId: string; description: string; businessDay: string },
  ) {
    return withTransaction(async (client) => {
      // Check idempotency
      const existing = await this.repo.findByIdempotencyKey(params.idempotencyKey, client);
      if (existing) {
        return existing;
      }

      // Get original entry
      const original = await this.repo.findEntryById(entryId, client);
      if (!original) {
        throw new NotFoundError('JournalEntry', entryId);
      }
      if (original.status === 'REVERSED') {
        throw new ConflictError('Entry is already reversed');
      }

      // Get original lines
      const originalLines = await this.repo.findLinesByEntryId(entryId, client);

      // Create reversal: swap debits/credits
      const reversedLines = originalLines.map((line, idx) => ({
        accountId: line.account_id,
        debitCredit: (line.debit_credit === 'DEBIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT',
        amount: line.amount,
        currencyCode: line.currency_code,
      }));

      const reversalEntry = await this.repo.createReversalEntry(
        {
          subledger: original.subledger,
          description: params.description,
          correlationId: params.correlationId,
          idempotencyKey: params.idempotencyKey,
          businessDay: params.businessDay,
          reversedEntryId: entryId,
        },
        client,
      );

      const lines = await this.repo.createJournalLines(reversalEntry.id, reversedLines, client);

      // Mark original as reversed
      await this.repo.markEntryReversed(entryId, client);

      // Outbox event
      await this.repo.createOutboxEvent(
        EventTypes.LEDGER_REVERSED,
        params.correlationId,
        {
          reversalEntryId: reversalEntry.id,
          originalEntryId: entryId,
          subledger: original.subledger,
          description: params.description,
          businessDay: params.businessDay,
          lines: reversedLines,
        },
        client,
      );

      return { ...reversalEntry, lines };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  async getStatement(accountId: string, pagination: PaginationParams) {
    const limit = Math.min(pagination.limit ?? 50, 100);
    return this.repo.getStatementLines(accountId, pagination.cursor, limit);
  }
}
