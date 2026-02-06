/**
 * Pricing engine: evaluates pricing rules to compute fees and commissions.
 *
 * Supports:
 * - FLAT, PERCENTAGE, TIERED calculation types
 * - Rule precedence via priority (lower number = higher)
 * - Country/product/entity overrides (more specific = higher precedence)
 * - FIRST match mode (stop at first matching rule per component)
 * - ACCUMULATE match mode (sum all matching rules per component)
 * - Min/max clamping per rule
 */
import {
  PricingCalcType,
  PricingComponentType,
  PricingRuleMatchMode,
  PricingTier,
  PricingRuleTraceEntry,
} from './types';

export interface PricingRuleInput {
  id: string;
  name: string;
  componentType: PricingComponentType;
  matchMode: PricingRuleMatchMode;
  calcType: PricingCalcType;
  flatAmount?: string;
  percentageRate?: string;
  tierConfig?: PricingTier[];
  minAmount?: string;
  maxAmount?: string;
  priority: number;
  // Scope fields for matching
  countryCode?: string;
  productCode?: string;
  entityId?: string;
}

export interface PricingContext {
  amount: string;             // principal amount
  countryCode?: string;
  productCode?: string;
  entityId?: string;
}

export interface PricingResult {
  totalFees: string;
  totalCommission: string;
  totalTax: string;
  totalDiscount: string;
  totalAmount: string;        // principal + fees + commission + tax - discount
  ruleTrace: PricingRuleTraceEntry[];
}

/**
 * Calculate the output of a single pricing rule given an input amount.
 * NOTE: Uses Number for intermediate arithmetic. For production with sub-cent
 * precision requirements, replace with a decimal library (e.g., decimal.js).
 * Final values are stored as NUMERIC(20,8) in the database.
 */
export function calculateRuleOutput(
  calcType: PricingCalcType,
  inputAmount: string,
  flatAmount?: string,
  percentageRate?: string,
  tierConfig?: PricingTier[],
  minAmount?: string,
  maxAmount?: string,
): string {
  let result: number;
  const input = Number(inputAmount);

  switch (calcType) {
    case 'FLAT':
      result = Number(flatAmount ?? '0');
      break;

    case 'PERCENTAGE':
      result = input * Number(percentageRate ?? '0') / 100;
      break;

    case 'TIERED': {
      result = 0;
      if (tierConfig && tierConfig.length > 0) {
        for (const tier of tierConfig) {
          const tierMin = Number(tier.min);
          const tierMax = Number(tier.max);
          if (input >= tierMin && input <= tierMax) {
            if (tier.flat) result += Number(tier.flat);
            if (tier.rate) result += input * Number(tier.rate) / 100;
            break; // First matching tier
          }
        }
      }
      break;
    }

    default:
      result = 0;
  }

  // Apply min/max clamping
  if (minAmount !== undefined) {
    result = Math.max(result, Number(minAmount));
  }
  if (maxAmount !== undefined) {
    result = Math.min(result, Number(maxAmount));
  }

  // Round to 8 decimal places to match DB precision
  return result.toFixed(8);
}

/**
 * Check if a rule matches the given context based on scope fields.
 * More specific rules (with country/product/entity) take precedence.
 */
export function ruleMatchesContext(
  rule: PricingRuleInput,
  context: PricingContext,
): boolean {
  if (rule.countryCode && rule.countryCode !== context.countryCode) return false;
  if (rule.productCode && rule.productCode !== context.productCode) return false;
  if (rule.entityId && rule.entityId !== context.entityId) return false;
  return true;
}

/**
 * Evaluate all matching rules for a given context and produce a pricing result.
 * Rules are sorted by priority (lower = higher precedence).
 */
export function evaluatePricingRules(
  rules: PricingRuleInput[],
  context: PricingContext,
): PricingResult {
  // Sort by priority ascending (lower = higher precedence)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  const trace: PricingRuleTraceEntry[] = [];
  const componentTotals: Record<PricingComponentType, number> = {
    FEE: 0,
    COMMISSION: 0,
    TAX: 0,
    DISCOUNT: 0,
  };

  // Track which component types we've already matched in FIRST mode
  const firstMatched = new Set<PricingComponentType>();

  for (const rule of sorted) {
    if (!ruleMatchesContext(rule, context)) continue;

    // In FIRST mode, skip if we already matched this component type
    if (rule.matchMode === 'FIRST' && firstMatched.has(rule.componentType)) continue;

    const output = calculateRuleOutput(
      rule.calcType,
      context.amount,
      rule.flatAmount,
      rule.percentageRate,
      rule.tierConfig,
      rule.minAmount,
      rule.maxAmount,
    );

    const outputNum = Number(output);
    componentTotals[rule.componentType] += outputNum;

    trace.push({
      ruleId: rule.id,
      ruleName: rule.name,
      componentType: rule.componentType,
      calcType: rule.calcType,
      inputAmount: context.amount,
      outputAmount: output,
      priority: rule.priority,
    });

    if (rule.matchMode === 'FIRST') {
      firstMatched.add(rule.componentType);
    }
  }

  const principal = Number(context.amount);
  const totalAmount = principal
    + componentTotals.FEE
    + componentTotals.COMMISSION
    + componentTotals.TAX
    - componentTotals.DISCOUNT;

  return {
    totalFees: componentTotals.FEE.toFixed(8),
    totalCommission: componentTotals.COMMISSION.toFixed(8),
    totalTax: componentTotals.TAX.toFixed(8),
    totalDiscount: componentTotals.DISCOUNT.toFixed(8),
    totalAmount: totalAmount.toFixed(8),
    ruleTrace: trace,
  };
}
