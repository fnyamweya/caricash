/**
 * Tests for the payment state machine.
 */
import {
  isValidTransition,
  nextHappyPathStatus,
  isTerminalStatus,
  validNextStates,
  HAPPY_PATH,
  TERMINAL_STATES,
} from './payment-state-machine';
import { PaymentStatus } from './types';

describe('Payment State Machine', () => {
  describe('Happy path transitions', () => {
    it('INITIATED → AUTHORIZED is valid', () => {
      expect(isValidTransition('INITIATED', 'AUTHORIZED')).toBe(true);
    });

    it('AUTHORIZED → LEDGER_POSTED is valid', () => {
      expect(isValidTransition('AUTHORIZED', 'LEDGER_POSTED')).toBe(true);
    });

    it('LEDGER_POSTED → NOTIFIED is valid', () => {
      expect(isValidTransition('LEDGER_POSTED', 'NOTIFIED')).toBe(true);
    });

    it('NOTIFIED → COMPLETED is valid', () => {
      expect(isValidTransition('NOTIFIED', 'COMPLETED')).toBe(true);
    });

    it('full happy path is: INITIATED → AUTHORIZED → LEDGER_POSTED → NOTIFIED → COMPLETED', () => {
      expect(HAPPY_PATH).toEqual([
        'INITIATED', 'AUTHORIZED', 'LEDGER_POSTED', 'NOTIFIED', 'COMPLETED',
      ]);
    });
  });

  describe('Failure transitions', () => {
    const nonTerminalStates: PaymentStatus[] = [
      'INITIATED', 'AUTHORIZED', 'LEDGER_POSTED', 'NOTIFIED',
    ];

    for (const status of nonTerminalStates) {
      it(`${status} → FAILED is valid`, () => {
        expect(isValidTransition(status, 'FAILED')).toBe(true);
      });
    }
  });

  describe('Invalid transitions', () => {
    it('COMPLETED → anything is invalid (terminal)', () => {
      expect(isValidTransition('COMPLETED', 'INITIATED')).toBe(false);
      expect(isValidTransition('COMPLETED', 'FAILED')).toBe(false);
    });

    it('FAILED → anything is invalid (terminal)', () => {
      expect(isValidTransition('FAILED', 'INITIATED')).toBe(false);
      expect(isValidTransition('FAILED', 'AUTHORIZED')).toBe(false);
    });

    it('skipping states is invalid', () => {
      expect(isValidTransition('INITIATED', 'LEDGER_POSTED')).toBe(false);
      expect(isValidTransition('INITIATED', 'COMPLETED')).toBe(false);
      expect(isValidTransition('AUTHORIZED', 'COMPLETED')).toBe(false);
    });

    it('backward transitions are invalid', () => {
      expect(isValidTransition('AUTHORIZED', 'INITIATED')).toBe(false);
      expect(isValidTransition('COMPLETED', 'NOTIFIED')).toBe(false);
    });
  });

  describe('nextHappyPathStatus', () => {
    it('returns AUTHORIZED for INITIATED', () => {
      expect(nextHappyPathStatus('INITIATED')).toBe('AUTHORIZED');
    });

    it('returns undefined for COMPLETED (terminal)', () => {
      expect(nextHappyPathStatus('COMPLETED')).toBeUndefined();
    });

    it('returns undefined for FAILED (not on happy path)', () => {
      expect(nextHappyPathStatus('FAILED')).toBeUndefined();
    });
  });

  describe('isTerminalStatus', () => {
    it('COMPLETED is terminal', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
    });

    it('FAILED is terminal', () => {
      expect(isTerminalStatus('FAILED')).toBe(true);
    });

    it('INITIATED is not terminal', () => {
      expect(isTerminalStatus('INITIATED')).toBe(false);
    });
  });

  describe('validNextStates', () => {
    it('INITIATED can go to AUTHORIZED or FAILED', () => {
      expect(validNextStates('INITIATED')).toEqual(['AUTHORIZED', 'FAILED']);
    });

    it('COMPLETED has no next states', () => {
      expect(validNextStates('COMPLETED')).toEqual([]);
    });
  });

  describe('Terminal states set', () => {
    it('contains exactly COMPLETED and FAILED', () => {
      expect(TERMINAL_STATES.size).toBe(2);
      expect(TERMINAL_STATES.has('COMPLETED')).toBe(true);
      expect(TERMINAL_STATES.has('FAILED')).toBe(true);
    });
  });
});
