import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Policy, PolicyRule, PolicySubject, PolicyResource } from './types';

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

  /**
   * Evaluate if a subject is allowed to perform an action on a resource.
   * Default deny: if no rule explicitly allows, the action is denied.
   */
  isAllowed(subject: PolicySubject, action: string, resource: PolicyResource): boolean {
    let allowed = false;

    for (const policy of this.policies) {
      for (const rule of policy.rules) {
        if (!this.matchesAction(rule, action)) continue;
        if (!this.matchesResource(rule, resource)) continue;
        if (!this.matchesSubject(rule, subject)) continue;

        if (rule.effect === 'DENY') return false;
        if (rule.effect === 'ALLOW') allowed = true;
      }
    }

    return allowed;
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
}

/**
 * Convenience function for one-shot policy evaluation.
 */
let defaultEngine: PolicyEngine | null = null;

export function isAllowed(
  subject: PolicySubject,
  action: string,
  resource: PolicyResource,
): boolean {
  if (!defaultEngine) {
    defaultEngine = new PolicyEngine();
    const policiesDir = path.resolve(process.cwd(), 'policies');
    defaultEngine.loadFromDirectory(policiesDir);
  }
  return defaultEngine.isAllowed(subject, action, resource);
}
