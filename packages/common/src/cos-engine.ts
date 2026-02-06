/**
 * Dynamic Cost of Service (CoS) rules engine.
 *
 * Evaluates safe JSON AST conditions (no arbitrary code execution).
 * Supports:
 * - FIRST match mode: stop at first matching rule
 * - ACCUMULATE match mode: sum all matching rules
 * - Operators: eq, ne, gt, gte, lt, lte, in, not_in, between
 * - Output types: MEMO (informational) or LEDGER_POSTING (generates ledger lines)
 * - Deterministic evaluation with full trace for replay
 */
import {
  CosCondition,
  CosComponent,
  CosMatchMode,
  CosOperator,
  CosOutputType,
  CosRuleTraceEntry,
  CosComponentResult,
  PricingCalcType,
  PricingTier,
} from './types';

export interface CosRuleInput {
  id: string;
  name: string;
  matchMode: CosMatchMode;
  conditions: CosCondition[];
  outputType: CosOutputType;
  components: CosComponent[];
  priority: number;
}

export interface CosEvalContext {
  /** The input fields to match conditions against */
  fields: Record<string, string | number>;
  /** The principal amount for percentage/tiered calculations */
  amount: string;
}

export interface CosEvalResult {
  totalCost: string;
  ruleTrace: CosRuleTraceEntry[];
  /** Components that should generate ledger postings */
  ledgerComponents: CosComponentResult[];
  /** Components that are memo-only */
  memoComponents: CosComponentResult[];
}

// Allowed operators for the safe JSON AST
const ALLOWED_OPERATORS: ReadonlySet<CosOperator> = new Set([
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'between',
]);

/**
 * Evaluate a single condition against the context fields.
 */
export function evaluateCondition(
  condition: CosCondition,
  fields: Record<string, string | number>,
): boolean {
  if (!ALLOWED_OPERATORS.has(condition.operator)) return false;

  const fieldValue = fields[condition.field];
  if (fieldValue === undefined) return false;

  const numField = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue);
  const isNumeric = !isNaN(numField);

  switch (condition.operator) {
    case 'eq':
      return String(fieldValue) === String(condition.value);

    case 'ne':
      return String(fieldValue) !== String(condition.value);

    case 'gt':
      return isNumeric && numField > Number(condition.value);

    case 'gte':
      return isNumeric && numField >= Number(condition.value);

    case 'lt':
      return isNumeric && numField < Number(condition.value);

    case 'lte':
      return isNumeric && numField <= Number(condition.value);

    case 'in':
      if (!Array.isArray(condition.value)) return false;
      return condition.value.includes(String(fieldValue));

    case 'not_in':
      if (!Array.isArray(condition.value)) return false;
      return !condition.value.includes(String(fieldValue));

    case 'between': {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) return false;
      const [min, max] = condition.value;
      return isNumeric && numField >= Number(min) && numField <= Number(max);
    }

    default:
      return false;
  }
}

/**
 * Check if all conditions of a rule match the context.
 */
export function allConditionsMatch(
  conditions: CosCondition[],
  fields: Record<string, string | number>,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, fields));
}

/**
 * Calculate a component's output amount.
 */
function calculateComponentOutput(
  component: CosComponent,
  inputAmount: string,
): string {
  const calcType: PricingCalcType = component.calcType;
  const input = Number(inputAmount);
  let result: number;

  switch (calcType) {
    case 'FLAT':
      result = Number(component.flat ?? '0');
      break;

    case 'PERCENTAGE':
      result = input * Number(component.rate ?? '0') / 100;
      break;

    case 'TIERED': {
      result = 0;
      const tiers: PricingTier[] = component.tiers ?? [];
      for (const tier of tiers) {
        if (input >= Number(tier.min) && input <= Number(tier.max)) {
          if (tier.flat) result += Number(tier.flat);
          if (tier.rate) result += input * Number(tier.rate) / 100;
          break;
        }
      }
      break;
    }

    default:
      result = 0;
  }

  return result.toFixed(8);
}

/**
 * Evaluate all CoS rules against a context and produce a result with trace.
 * Rules are sorted by priority (lower = higher precedence).
 * Deterministic: same inputs always produce same outputs.
 */
export function evaluateCosRules(
  rules: CosRuleInput[],
  context: CosEvalContext,
): CosEvalResult {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  const trace: CosRuleTraceEntry[] = [];
  const ledgerComponents: CosComponentResult[] = [];
  const memoComponents: CosComponentResult[] = [];
  let totalCost = 0;
  let firstMatched = false;

  for (const rule of sorted) {
    // In FIRST mode globally, stop after first match
    if (firstMatched && rule.matchMode === 'FIRST') continue;

    const matched = allConditionsMatch(rule.conditions, context.fields);

    const componentResults: CosComponentResult[] = [];

    if (matched) {
      for (const component of rule.components) {
        const amount = calculateComponentOutput(component, context.amount);
        const componentResult: CosComponentResult = {
          name: component.name,
          amount,
          memo: component.memo,
        };
        componentResults.push(componentResult);
        totalCost += Number(amount);

        if (rule.outputType === 'LEDGER_POSTING') {
          ledgerComponents.push(componentResult);
        } else {
          memoComponents.push(componentResult);
        }
      }

      if (rule.matchMode === 'FIRST') {
        firstMatched = true;
      }
    }

    trace.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matchMode: rule.matchMode,
      conditionsMatched: matched,
      components: componentResults,
    });
  }

  return {
    totalCost: totalCost.toFixed(8),
    ruleTrace: trace,
    ledgerComponents,
    memoComponents,
  };
}
