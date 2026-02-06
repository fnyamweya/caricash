import { Injectable } from '@nestjs/common';
import { LedgerRepository } from './ledger.repository';
import { withTransaction } from '@caricash/db';
import { PostingRequest, ValidationError, ConflictError, NotFoundError, PaginationParams } from '@caricash/common';
import { EventTypes } from '@caricash/events';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly auditService: AuditService,
  ) {}

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
      if (!request.description || request.description.trim().length === 0) {
        throw new ValidationError('Narration is required');
      }
      if (!request.reference || request.reference.trim().length === 0) {
        throw new ValidationError('Reference is required');
      }

      // Create journal entry + lines via stored procedure
      const entry = await this.repo.postEntryViaProcedure(request, client);
      if (!entry) {
        throw new ConflictError('Failed to create journal entry');
      }

      // Write outbox event in same transaction
      await this.repo.createOutboxEvent(
        EventTypes.LEDGER_POSTED,
        request.correlationId,
        {
          entryId: entry.id,
          entryNumber: entry.entry_number,
          subledger: request.subledger,
          description: request.description,
          reference: request.reference,
          businessDay: request.businessDay,
          idempotencyKey: request.idempotencyKey,
          lines: request.lines,
          metadata: request.metadata ?? {},
          entryHash: entry.entry_hash,
        },
        client,
      );

      const auditEvent = await this.auditService.recordWithClient({
        actorType: 'SYSTEM',
        action: 'ledger.post',
        resourceType: 'ledger_entry',
        resourceId: entry.id,
        payload: {
          entryId: entry.id,
          entryHash: entry.entry_hash,
          idempotencyKey: request.idempotencyKey,
        },
        correlationId: request.correlationId,
      }, client);

      return {
        ...entry,
        receipt: {
          entryId: entry.id,
          entryHash: entry.entry_hash,
          auditEventHash: auditEvent.hash,
        },
      };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  async reverseEntry(
    entryId: string,
    params: { idempotencyKey: string; correlationId: string; description: string; reference: string; businessDay: string },
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
      const existingReversal = await this.repo.findReversalByEntryId(entryId, client);
      if (existingReversal) {
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

      const reversalEntry = await this.repo.postEntryViaProcedure(
        {
          subledger: original.subledger,
          description: params.description,
          reference: params.reference,
          correlationId: params.correlationId,
          idempotencyKey: params.idempotencyKey,
          businessDay: params.businessDay,
          lines: reversedLines,
          metadata: {},
          reversedEntryId: entryId,
        },
        client,
      );
      if (!reversalEntry) {
        throw new ConflictError('Failed to create reversal entry');
      }

      // Outbox event
      await this.repo.createOutboxEvent(
        EventTypes.LEDGER_REVERSED,
        params.correlationId,
        {
          reversalEntryId: reversalEntry.id,
          originalEntryId: entryId,
          subledger: original.subledger,
          description: params.description,
          reference: params.reference,
          businessDay: params.businessDay,
          lines: reversedLines,
        },
        client,
      );

      const auditEvent = await this.auditService.recordWithClient({
        actorType: 'SYSTEM',
        action: 'ledger.reverse',
        resourceType: 'ledger_entry',
        resourceId: reversalEntry.id,
        payload: {
          entryId: reversalEntry.id,
          entryHash: reversalEntry.entry_hash,
          originalEntryId: entryId,
        },
        correlationId: params.correlationId,
      }, client);

      return {
        ...reversalEntry,
        receipt: {
          entryId: reversalEntry.id,
          entryHash: reversalEntry.entry_hash,
          auditEventHash: auditEvent.hash,
        },
      };
    }, { isolationLevel: 'SERIALIZABLE' });
  }

  async getStatement(accountId: string, pagination: PaginationParams) {
    const limit = Math.min(pagination.limit ?? 50, 100);
    return this.repo.getStatementLines(accountId, pagination.cursor, limit);
  }
}
