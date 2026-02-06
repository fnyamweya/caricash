import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Policy, PolicyRule, PolicySubject, PolicyResource, PolicyDecision, PolicyContext, ConditionValue } from './types';
import { ABAC_ATTRIBUTE_WHITELIST } from '@caricash/common';

export class PolicyEngine {
  private policies: Policy[] = [];

  /**
   * Load policies from a directory of YAML files.
   */
  loadFromDirectory(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const policy = yaml.load(content) as Policy;
      if (policy && policy.rules) {
        this.policies.push(policy);
      }
    }
  }

  evaluate(subject: PolicySubject, action: string, resource: PolicyResource, context: PolicyContext = {}): PolicyDecision {
    const reasonCodes: string[] = [];
    const obligations: string[] = [];

    if (!this.subjectAttributesWhitelisted(subject.attributes ?? {})) {
      return { allow: false, reasonCodes: ['ABAC_ATTRIBUTE_NOT_ALLOWED'], obligations: [] };
    }

    if (subject.principalId && resource.attributes?.principalId && subject.principalId !== resource.attributes.principalId) {
      return { allow: false, reasonCodes: ['PRINCIPAL_BOUNDARY'], obligations: [] };
    }

    let allowed = false;

    for (const policy of this.policies) {
      for (const rule of policy.rules) {
        if (!this.matchesAction(rule, action)) continue;
        if (!this.matchesResource(rule, resource)) continue;
        if (!this.matchesSubject(rule, subject)) continue;
        if (!this.matchesConditions(rule, subject, resource, context)) continue;

        if (rule.effect === 'DENY') {
          reasonCodes.push(rule.reason ?? 'EXPLICIT_DENY');
          return { allow: false, reasonCodes, obligations };
        }
        if (rule.effect === 'ALLOW') {
          allowed = true;
          if (rule.reason) reasonCodes.push(rule.reason);
          if (rule.obligations) obligations.push(...rule.obligations);
        }
      }
    }

    if (!allowed) {
      reasonCodes.push('NO_MATCH');
    }

    return { allow: allowed, reasonCodes, obligations };
  }

  /**
   * Evaluate if a subject is allowed to perform an action on a resource.
   * Default deny: if no rule explicitly allows, the action is denied.
   */
  isAllowed(subject: PolicySubject, action: string, resource: PolicyResource, context: PolicyContext = {}): boolean {
    return this.evaluate(subject, action, resource, context).allow;
  }

  private matchesSubject(rule: PolicyRule, subject: PolicySubject): boolean {
    return rule.subjects.some((s) => {
      if (s === '*') return true;
      if (s.startsWith('role:')) {
        return subject.roles.includes(s.slice(5));
      }
      return s === subject.principalType;
    });
  }

  private matchesAction(rule: PolicyRule, action: string): boolean {
    return rule.actions.some((a) => a === '*' || a === action);
  }

  private matchesResource(rule: PolicyRule, resource: PolicyResource): boolean {
    return rule.resources.some((r) => {
      if (r === '*') return true;
      const [type, id] = r.split(':');
      if (type !== resource.type) return false;
      return !id || id === '*' || id === resource.id;
    });
  }

  private matchesConditions(
    rule: PolicyRule,
    subject: PolicySubject,
    resource: PolicyResource,
    context: PolicyContext,
  ): boolean {
    if (!rule.conditions) return true;
    const { subject: subjectConditions, resource: resourceConditions, context: contextConditions } = rule.conditions;

    return (
      this.matchesConditionGroup(subject.attributes ?? {}, subjectConditions) &&
      this.matchesConditionGroup(resource.attributes ?? {}, resourceConditions) &&
      this.matchesConditionGroup(context, contextConditions)
    );
  }

  private matchesConditionGroup(
    actual: Record<string, unknown>,
    conditions?: Record<string, ConditionValue>,
  ): boolean {
    if (!conditions) return true;
    return Object.entries(conditions).every(([key, expected]) =>
      this.matchesConditionValue(actual[key], expected),
    );
  }

  private matchesConditionValue(actual: unknown, expected: ConditionValue): boolean {
    if (expected === undefined) return true;
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      const { anyOf, allOf, contains, gte, lte } = expected as {
        anyOf?: Array<string | number | boolean>;
        allOf?: Array<string | number | boolean>;
        contains?: string;
        gte?: number;
        lte?: number;
      };
      if (anyOf && !anyOf.includes(actual as string | number | boolean)) return false;
      if (allOf && (!Array.isArray(actual) || !allOf.every((item) => (actual as unknown[]).includes(item)))) return false;
      if (contains && (!Array.isArray(actual) || !(actual as unknown[]).includes(contains))) return false;
      if (gte !== undefined && typeof actual === 'number' && actual < gte) return false;
      if (lte !== undefined && typeof actual === 'number' && actual > lte) return false;
      return true;
    }
    if (Array.isArray(expected)) {
      const expectedValues = expected as Array<string | number | boolean>;
      if (Array.isArray(actual)) {
        return expectedValues.some((item) => (actual as unknown[]).includes(item));
      }
      return expectedValues.includes(actual as string | number | boolean);
    }
    return actual === expected;
  }

  private subjectAttributesWhitelisted(attributes: Record<string, unknown>): boolean {
    const whitelist = Array.from((ABAC_ATTRIBUTE_WHITELIST ?? []) as readonly string[]);
    return Object.keys(attributes).every((key) => whitelist.includes(key));
  }
}

/**
 * Convenience function for one-shot policy evaluation.
 */
let defaultEngine: PolicyEngine | null = null;

export function isAllowed(
  subject: PolicySubject,
  action: string,
  resource: PolicyResource,
  context: PolicyContext = {},
): boolean {
  if (!defaultEngine) {
    defaultEngine = new PolicyEngine();
    const policiesDir = path.resolve(process.cwd(), 'policies');
    defaultEngine.loadFromDirectory(policiesDir);
  }
  return defaultEngine.isAllowed(subject, action, resource, context);
}
