/**
 * Tests for the CoS (Cost of Service) rules engine.
 */
import {
  evaluateCondition,
  allConditionsMatch,
  evaluateCosRules,
  CosRuleInput,
  CosEvalContext,
} from './cos-engine';
import { CosCondition } from './types';

describe('CoS Rules Engine', () => {
  describe('evaluateCondition', () => {
    it('eq: matches equal string values', () => {
      expect(evaluateCondition({ field: 'country', operator: 'eq', value: 'BB' }, { country: 'BB' })).toBe(true);
      expect(evaluateCondition({ field: 'country', operator: 'eq', value: 'BB' }, { country: 'US' })).toBe(false);
    });

    it('ne: matches non-equal values', () => {
      expect(evaluateCondition({ field: 'country', operator: 'ne', value: 'BB' }, { country: 'US' })).toBe(true);
    });

    it('gt: numeric greater than', () => {
      expect(evaluateCondition({ field: 'amount', operator: 'gt', value: '100' }, { amount: 200 })).toBe(true);
      expect(evaluateCondition({ field: 'amount', operator: 'gt', value: '100' }, { amount: 50 })).toBe(false);
    });

    it('gte: numeric greater than or equal', () => {
      expect(evaluateCondition({ field: 'amount', operator: 'gte', value: '100' }, { amount: 100 })).toBe(true);
    });

    it('lt: numeric less than', () => {
      expect(evaluateCondition({ field: 'amount', operator: 'lt', value: '100' }, { amount: 50 })).toBe(true);
    });

    it('lte: numeric less than or equal', () => {
      expect(evaluateCondition({ field: 'amount', operator: 'lte', value: '100' }, { amount: 100 })).toBe(true);
    });

    it('in: field value is in array', () => {
      expect(evaluateCondition({ field: 'type', operator: 'in', value: ['DEPOSIT', 'WITHDRAWAL'] }, { type: 'DEPOSIT' })).toBe(true);
      expect(evaluateCondition({ field: 'type', operator: 'in', value: ['DEPOSIT', 'WITHDRAWAL'] }, { type: 'TRANSFER' })).toBe(false);
    });

    it('not_in: field value is not in array', () => {
      expect(evaluateCondition({ field: 'type', operator: 'not_in', value: ['DEPOSIT'] }, { type: 'TRANSFER' })).toBe(true);
    });

    it('between: numeric range check', () => {
      expect(evaluateCondition({ field: 'amount', operator: 'between', value: ['100', '500'] }, { amount: 250 })).toBe(true);
      expect(evaluateCondition({ field: 'amount', operator: 'between', value: ['100', '500'] }, { amount: 50 })).toBe(false);
    });

    it('returns false for missing field', () => {
      expect(evaluateCondition({ field: 'missing', operator: 'eq', value: 'X' }, { other: 'Y' })).toBe(false);
    });

    it('returns false for invalid operator', () => {
      expect(evaluateCondition({ field: 'x', operator: 'INVALID' as CosCondition['operator'], value: '1' }, { x: '1' })).toBe(false);
    });
  });

  describe('allConditionsMatch', () => {
    it('empty conditions always match', () => {
      expect(allConditionsMatch([], {})).toBe(true);
    });

    it('all conditions must match', () => {
      const conditions: CosCondition[] = [
        { field: 'country', operator: 'eq', value: 'BB' },
        { field: 'amount', operator: 'gt', value: '100' },
      ];
      expect(allConditionsMatch(conditions, { country: 'BB', amount: 200 })).toBe(true);
      expect(allConditionsMatch(conditions, { country: 'BB', amount: 50 })).toBe(false);
    });
  });

  describe('evaluateCosRules', () => {
    it('FIRST mode: stops at first matching rule', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'Primary', matchMode: 'FIRST', priority: 10,
          outputType: 'MEMO',
          conditions: [{ field: 'type', operator: 'eq', value: 'DEPOSIT' }],
          components: [{ name: 'processing', calcType: 'FLAT', flat: '5' }],
        },
        {
          id: 'r2', name: 'Secondary', matchMode: 'FIRST', priority: 20,
          outputType: 'MEMO',
          conditions: [{ field: 'type', operator: 'eq', value: 'DEPOSIT' }],
          components: [{ name: 'processing', calcType: 'FLAT', flat: '10' }],
        },
      ];
      const ctx: CosEvalContext = { fields: { type: 'DEPOSIT' }, amount: '1000' };
      const result = evaluateCosRules(rules, ctx);

      expect(result.totalCost).toBe('5.00000000');
      expect(result.memoComponents).toHaveLength(1);
    });

    it('ACCUMULATE mode: sums all matching rules', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'Base Cost', matchMode: 'ACCUMULATE', priority: 10,
          outputType: 'MEMO',
          conditions: [],
          components: [{ name: 'base', calcType: 'FLAT', flat: '5' }],
        },
        {
          id: 'r2', name: 'Variable Cost', matchMode: 'ACCUMULATE', priority: 20,
          outputType: 'MEMO',
          conditions: [],
          components: [{ name: 'variable', calcType: 'PERCENTAGE', rate: '1' }],
        },
      ];
      const ctx: CosEvalContext = { fields: {}, amount: '1000' };
      const result = evaluateCosRules(rules, ctx);

      // 5 + 1% of 1000 = 5 + 10 = 15
      expect(result.totalCost).toBe('15.00000000');
    });

    it('separates ledger posting components from memo components', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'Ledger Cost', matchMode: 'ACCUMULATE', priority: 10,
          outputType: 'LEDGER_POSTING',
          conditions: [],
          components: [{ name: 'bank_fee', calcType: 'FLAT', flat: '3' }],
        },
        {
          id: 'r2', name: 'Memo Cost', matchMode: 'ACCUMULATE', priority: 20,
          outputType: 'MEMO',
          conditions: [],
          components: [{ name: 'info', calcType: 'FLAT', flat: '0', memo: 'Informational only' }],
        },
      ];
      const ctx: CosEvalContext = { fields: {}, amount: '500' };
      const result = evaluateCosRules(rules, ctx);

      expect(result.ledgerComponents).toHaveLength(1);
      expect(result.ledgerComponents[0].name).toBe('bank_fee');
      expect(result.memoComponents).toHaveLength(1);
      expect(result.memoComponents[0].memo).toBe('Informational only');
    });

    it('produces deterministic trace for replay', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'Rule A', matchMode: 'ACCUMULATE', priority: 10,
          outputType: 'MEMO',
          conditions: [{ field: 'country', operator: 'eq', value: 'BB' }],
          components: [{ name: 'cost_a', calcType: 'FLAT', flat: '7' }],
        },
        {
          id: 'r2', name: 'Rule B', matchMode: 'ACCUMULATE', priority: 20,
          outputType: 'MEMO',
          conditions: [{ field: 'country', operator: 'eq', value: 'US' }],
          components: [{ name: 'cost_b', calcType: 'FLAT', flat: '12' }],
        },
      ];
      const ctx: CosEvalContext = { fields: { country: 'BB' }, amount: '100' };
      const result = evaluateCosRules(rules, ctx);

      expect(result.ruleTrace).toHaveLength(2);
      expect(result.ruleTrace[0].conditionsMatched).toBe(true);
      expect(result.ruleTrace[1].conditionsMatched).toBe(false);
      expect(result.ruleTrace[1].components).toHaveLength(0);
    });

    it('non-matching rules produce zero cost', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'US Only', matchMode: 'FIRST', priority: 10,
          outputType: 'MEMO',
          conditions: [{ field: 'country', operator: 'eq', value: 'US' }],
          components: [{ name: 'cost', calcType: 'FLAT', flat: '100' }],
        },
      ];
      const ctx: CosEvalContext = { fields: { country: 'BB' }, amount: '500' };
      const result = evaluateCosRules(rules, ctx);

      expect(result.totalCost).toBe('0.00000000');
    });

    it('tiered component calculation works', () => {
      const rules: CosRuleInput[] = [
        {
          id: 'r1', name: 'Tiered', matchMode: 'FIRST', priority: 10,
          outputType: 'LEDGER_POSTING',
          conditions: [],
          components: [{
            name: 'processing_fee', calcType: 'TIERED',
            tiers: [
              { min: '0', max: '100', flat: '1' },
              { min: '101', max: '1000', flat: '5', rate: '0.5' },
            ],
          }],
        },
      ];
      const ctx: CosEvalContext = { fields: {}, amount: '500' };
      const result = evaluateCosRules(rules, ctx);

      // tier 101-1000: flat 5 + 0.5% of 500 = 5 + 2.5 = 7.5
      expect(result.totalCost).toBe('7.50000000');
    });
  });
});
