export interface PolicySubject {
  principalType: string;
  principalId?: string;
  roles: string[];
}

export interface PolicyResource {
  type: string;
  id?: string;
  attributes?: Record<string, unknown>;
}

export interface PolicyRule {
  effect: 'ALLOW' | 'DENY';
  subjects: string[];       // principal types or roles, e.g., 'STAFF', 'role:ADMIN'
  actions: string[];        // e.g., 'ledger.post', 'audit.read'
  resources: string[];      // e.g., 'ledger:*', 'audit:*'
  conditions?: Record<string, unknown>;
}

export interface Policy {
  name: string;
  version: string;
  rules: PolicyRule[];
}
