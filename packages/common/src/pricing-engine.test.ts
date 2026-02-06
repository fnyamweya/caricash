/**
 * Tests for the pricing engine.
 */
import {
  calculateRuleOutput,
  evaluatePricingRules,
  ruleMatchesContext,
  PricingRuleInput,
  PricingContext,
} from './pricing-engine';

describe('Pricing Engine', () => {
  describe('calculateRuleOutput', () => {
    it('FLAT: returns flat amount', () => {
      expect(calculateRuleOutput('FLAT', '1000', '5.00')).toBe('5.00000000');
    });

    it('PERCENTAGE: calculates percentage of input', () => {
      expect(calculateRuleOutput('PERCENTAGE', '1000', undefined, '2.5')).toBe('25.00000000');
    });

    it('TIERED: matches correct tier', () => {
      const tiers = [
        { min: '0', max: '500', flat: '5', rate: undefined },
        { min: '501', max: '1000', flat: '10', rate: undefined },
        { min: '1001', max: '10000', flat: '15', rate: '0.5' },
      ];
      expect(calculateRuleOutput('TIERED', '750', undefined, undefined, tiers)).toBe('10.00000000');
    });

    it('TIERED: applies tier with flat + rate', () => {
      const tiers = [
        { min: '1001', max: '10000', flat: '15', rate: '0.5' },
      ];
      // flat 15 + 0.5% of 2000 = 15 + 10 = 25
      expect(calculateRuleOutput('TIERED', '2000', undefined, undefined, tiers)).toBe('25.00000000');
    });

    it('applies min clamping', () => {
      expect(calculateRuleOutput('FLAT', '1000', '1.00', undefined, undefined, '5.00')).toBe('5.00000000');
    });

    it('applies max clamping', () => {
      expect(calculateRuleOutput('FLAT', '1000', '100.00', undefined, undefined, undefined, '50.00')).toBe('50.00000000');
    });
  });

  describe('ruleMatchesContext', () => {
    const rule: PricingRuleInput = {
      id: 'r1', name: 'Test', componentType: 'FEE', matchMode: 'FIRST',
      calcType: 'FLAT', flatAmount: '5', priority: 100,
      countryCode: 'BB', productCode: 'TRANSFER',
    };

    it('matches when context matches rule scope', () => {
      expect(ruleMatchesContext(rule, { amount: '100', countryCode: 'BB', productCode: 'TRANSFER' })).toBe(true);
    });

    it('does not match when country differs', () => {
      expect(ruleMatchesContext(rule, { amount: '100', countryCode: 'US', productCode: 'TRANSFER' })).toBe(false);
    });

    it('does not match when product differs', () => {
      expect(ruleMatchesContext(rule, { amount: '100', countryCode: 'BB', productCode: 'DEPOSIT' })).toBe(false);
    });

    it('global rule (no scope) matches everything', () => {
      const globalRule: PricingRuleInput = {
        id: 'r2', name: 'Global', componentType: 'FEE', matchMode: 'FIRST',
        calcType: 'FLAT', flatAmount: '1', priority: 999,
      };
      expect(ruleMatchesContext(globalRule, { amount: '100' })).toBe(true);
      expect(ruleMatchesContext(globalRule, { amount: '100', countryCode: 'BB' })).toBe(true);
    });
  });

  describe('evaluatePricingRules', () => {
    it('FIRST mode: picks highest priority (lowest number) rule per component', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'Global Fee', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '10', priority: 100 },
        { id: 'r2', name: 'Country Fee', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '5', priority: 50, countryCode: 'BB' },
      ];
      const context: PricingContext = { amount: '1000', countryCode: 'BB' };
      const result = evaluatePricingRules(rules, context);

      expect(result.totalFees).toBe('5.00000000'); // Country-specific wins
      expect(result.ruleTrace).toHaveLength(1); // Only one matched in FIRST mode
      expect(result.ruleTrace[0].ruleId).toBe('r2');
    });

    it('ACCUMULATE mode: sums all matching rules', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'Base Fee', componentType: 'FEE', matchMode: 'ACCUMULATE',
          calcType: 'FLAT', flatAmount: '5', priority: 100 },
        { id: 'r2', name: 'Service Fee', componentType: 'FEE', matchMode: 'ACCUMULATE',
          calcType: 'PERCENTAGE', percentageRate: '1', priority: 100 },
      ];
      const context: PricingContext = { amount: '1000' };
      const result = evaluatePricingRules(rules, context);

      // 5 + 1% of 1000 = 5 + 10 = 15
      expect(result.totalFees).toBe('15.00000000');
      expect(result.ruleTrace).toHaveLength(2);
    });

    it('computes totalAmount correctly (principal + fees + commission + tax - discount)', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'Fee', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '10', priority: 100 },
        { id: 'r2', name: 'Commission', componentType: 'COMMISSION', matchMode: 'FIRST',
          calcType: 'PERCENTAGE', percentageRate: '2', priority: 100 },
        { id: 'r3', name: 'Discount', componentType: 'DISCOUNT', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '5', priority: 100 },
      ];
      const context: PricingContext = { amount: '1000' };
      const result = evaluatePricingRules(rules, context);

      // 1000 + 10 + 20 + 0 - 5 = 1025
      expect(result.totalAmount).toBe('1025.00000000');
      expect(result.totalFees).toBe('10.00000000');
      expect(result.totalCommission).toBe('20.00000000');
      expect(result.totalDiscount).toBe('5.00000000');
    });

    it('rule trace contains all matched rules', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'Fee', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '10', priority: 100 },
      ];
      const context: PricingContext = { amount: '500' };
      const result = evaluatePricingRules(rules, context);

      expect(result.ruleTrace).toHaveLength(1);
      expect(result.ruleTrace[0]).toEqual({
        ruleId: 'r1',
        ruleName: 'Fee',
        componentType: 'FEE',
        calcType: 'FLAT',
        inputAmount: '500',
        outputAmount: '10.00000000',
        priority: 100,
      });
    });

    it('no matching rules returns zero fees', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'US Fee', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '10', priority: 100, countryCode: 'US' },
      ];
      const context: PricingContext = { amount: '1000', countryCode: 'BB' };
      const result = evaluatePricingRules(rules, context);

      expect(result.totalFees).toBe('0.00000000');
      expect(result.ruleTrace).toHaveLength(0);
    });

    it('precedence: entity > product > country > global', () => {
      const rules: PricingRuleInput[] = [
        { id: 'r1', name: 'Global', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '100', priority: 1000 },
        { id: 'r2', name: 'Country', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '50', priority: 500, countryCode: 'BB' },
        { id: 'r3', name: 'Product', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '25', priority: 250, countryCode: 'BB', productCode: 'TRANSFER' },
        { id: 'r4', name: 'Entity', componentType: 'FEE', matchMode: 'FIRST',
          calcType: 'FLAT', flatAmount: '10', priority: 100, countryCode: 'BB', productCode: 'TRANSFER', entityId: 'e1' },
      ];
      const context: PricingContext = { amount: '1000', countryCode: 'BB', productCode: 'TRANSFER', entityId: 'e1' };
      const result = evaluatePricingRules(rules, context);

      expect(result.totalFees).toBe('10.00000000');
      expect(result.ruleTrace[0].ruleId).toBe('r4');
    });
  });
});
