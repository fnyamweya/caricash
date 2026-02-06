export interface PolicySubject {
  principalType: string;
  principalId?: string;
  roles: string[];
  attributes?: Record<string, unknown>;
}

export interface PolicyResource {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface PolicyContext {
  countryCode?: string;
  channel?: string;
  [key: string]: unknown;
}

export interface PolicyDecision {
  allow: boolean;
  reasonCodes: string[];
  obligations: string[];
}

export type ConditionValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | {
      anyOf?: Array<string | number | boolean>;
      allOf?: Array<string | number | boolean>;
      contains?: string;
      gte?: number;
      lte?: number;
    };

export interface PolicyConditions {
  subject?: Record<string, ConditionValue>;
  resource?: Record<string, ConditionValue>;
  context?: Record<string, ConditionValue>;
}

export interface PolicyRule {
  effect: 'ALLOW' | 'DENY';
  subjects: string[];       // principal types or roles, e.g., 'STAFF', 'role:ADMIN'
  actions: string[];        // e.g., 'ledger.post', 'audit.read'
  resources: string[];      // e.g., 'ledger:*', 'audit:*'
  conditions?: PolicyConditions;
  reason?: string;
  obligations?: string[];
}

export interface Policy {
  name: string;
  version: string;
  rules: PolicyRule[];
}
