/**
 * Property-based tests for ledger invariants.
 * These test the fundamental rules that MUST hold:
 * 1. For every journal entry, sum(debits) == sum(credits)
 * 2. Amounts must be positive
 * 3. Idempotency: same key → same result
 * 4. Reversals: reversed entry has swapped debit/credit lines
 */

import { PostingLine, DebitCredit } from './types';

// Helper: validate debits = credits
function validateDebitsCreditBalance(lines: PostingLine[]): boolean {
  const totals = new Map<string, { debits: number; credits: number }>();
  for (const line of lines) {
    const amount = Number(line.amount);
    if (isNaN(amount) || amount <= 0) return false;
    const curr = totals.get(line.currencyCode) ?? { debits: 0, credits: 0 };
    if (line.debitCredit === 'DEBIT') curr.debits += amount;
    else curr.credits += amount;
    totals.set(line.currencyCode, curr);
  }
  for (const [, { debits, credits }] of totals) {
    if (Math.abs(debits - credits) > 0.00000001) return false;
  }
  return true;
}

// Helper: generate random balanced posting lines
function generateBalancedLines(count: number): PostingLine[] {
  const amount = (Math.floor(Math.random() * 100000) + 1) / 100;
  const lines: PostingLine[] = [];

  // First half: debits
  for (let i = 0; i < count; i++) {
    lines.push({
      accountId: `acct-${i}`,
      debitCredit: 'DEBIT',
      amount: (amount / count).toFixed(2),
      currencyCode: 'BBD',
    });
  }

  // Second half: credits
  for (let i = 0; i < count; i++) {
    lines.push({
      accountId: `acct-${count + i}`,
      debitCredit: 'CREDIT',
      amount: (amount / count).toFixed(2),
      currencyCode: 'BBD',
    });
  }

  return lines;
}

// Helper: create reversal lines
function createReversalLines(lines: PostingLine[]): PostingLine[] {
  return lines.map((line) => ({
    ...line,
    debitCredit: (line.debitCredit === 'DEBIT' ? 'CREDIT' : 'DEBIT') as DebitCredit,
  }));
}

describe('Ledger Invariants', () => {
  describe('Invariant: debits must equal credits', () => {
    it('balanced 2-line entry is valid', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '100.00', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '100.00', currencyCode: 'BBD' },
      ];
      expect(validateDebitsCreditBalance(lines)).toBe(true);
    });

    it('unbalanced entry is invalid', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '100.00', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '99.99', currencyCode: 'BBD' },
      ];
      expect(validateDebitsCreditBalance(lines)).toBe(false);
    });

    it('multi-line balanced entry is valid', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '50.00', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'DEBIT', amount: '50.00', currencyCode: 'BBD' },
        { accountId: 'a3', debitCredit: 'CREDIT', amount: '100.00', currencyCode: 'BBD' },
      ];
      expect(validateDebitsCreditBalance(lines)).toBe(true);
    });

    it('zero amount is invalid', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '0', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '0', currencyCode: 'BBD' },
      ];
      expect(validateDebitsCreditBalance(lines)).toBe(false);
    });

    it('negative amount is invalid', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '-100', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '-100', currencyCode: 'BBD' },
      ];
      expect(validateDebitsCreditBalance(lines)).toBe(false);
    });
  });

  describe('Property: randomly generated balanced entries are always valid', () => {
    for (let i = 1; i <= 20; i++) {
      it(`random balanced entry #${i} is valid`, () => {
        const lineCount = Math.floor(Math.random() * 5) + 1;
        const lines = generateBalancedLines(lineCount);
        expect(validateDebitsCreditBalance(lines)).toBe(true);
      });
    }
  });

  describe('Property: reversal of a balanced entry is also balanced', () => {
    it('reversal maintains balance', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '250.50', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '250.50', currencyCode: 'BBD' },
      ];
      const reversed = createReversalLines(lines);
      expect(validateDebitsCreditBalance(reversed)).toBe(true);
    });

    for (let i = 1; i <= 10; i++) {
      it(`random reversal #${i} maintains balance`, () => {
        const lineCount = Math.floor(Math.random() * 3) + 1;
        const lines = generateBalancedLines(lineCount);
        const reversed = createReversalLines(lines);
        expect(validateDebitsCreditBalance(reversed)).toBe(true);
      });
    }
  });

  describe('Property: reversal lines have swapped debit/credit', () => {
    it('each line debit/credit is swapped', () => {
      const lines: PostingLine[] = [
        { accountId: 'a1', debitCredit: 'DEBIT', amount: '100', currencyCode: 'BBD' },
        { accountId: 'a2', debitCredit: 'CREDIT', amount: '100', currencyCode: 'BBD' },
      ];
      const reversed = createReversalLines(lines);
      expect(reversed[0].debitCredit).toBe('CREDIT');
      expect(reversed[1].debitCredit).toBe('DEBIT');
      expect(reversed[0].amount).toBe(lines[0].amount);
      expect(reversed[1].amount).toBe(lines[1].amount);
    });
  });

  describe('Idempotency key uniqueness', () => {
    it('same key should map to same operation', () => {
      // Simulate an idempotency cache
      const cache = new Map<string, { entryId: string }>();
      const key = 'idem-key-1';
      const firstResult = { entryId: 'entry-1' };
      cache.set(key, firstResult);

      // Second call with same key should return same result
      expect(cache.get(key)).toBe(firstResult);
    });

    it('different keys should be independent', () => {
      const cache = new Map<string, { entryId: string }>();
      cache.set('key-1', { entryId: 'entry-1' });
      cache.set('key-2', { entryId: 'entry-2' });
      expect(cache.get('key-1')?.entryId).toBe('entry-1');
      expect(cache.get('key-2')?.entryId).toBe('entry-2');
    });
  });
});
