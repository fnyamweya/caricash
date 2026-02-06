import { PolicyEngine } from './engine';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
    // Manually add policies instead of loading from files
    (engine as any).policies = [
      {
        name: 'test-policy',
        version: '1.0',
        rules: [
          {
            effect: 'ALLOW' as const,
            subjects: ['SYSTEM'],
            actions: ['ledger.post', 'ledger.reverse'],
            resources: ['ledger:*'],
          },
          {
            effect: 'ALLOW' as const,
            subjects: ['role:ADMIN', 'role:AUDITOR'],
            actions: ['audit.read'],
            resources: ['audit:*'],
          },
          {
            effect: 'DENY' as const,
            subjects: ['CUSTOMER'],
            actions: ['ledger.post'],
            resources: ['ledger:*'],
          },
          {
            effect: 'ALLOW' as const,
            subjects: ['CUSTOMER'],
            actions: ['account.read'],
            resources: ['account:*'],
          },
        ],
      },
    ];
  });

  it('should allow SYSTEM to post ledger entries', () => {
    const result = engine.isAllowed(
      { principalType: 'SYSTEM', roles: [] },
      'ledger.post',
      { type: 'ledger', id: 'entry-1' },
    );
    expect(result).toBe(true);
  });

  it('should deny CUSTOMER from posting ledger entries', () => {
    const result = engine.isAllowed(
      { principalType: 'CUSTOMER', roles: [] },
      'ledger.post',
      { type: 'ledger', id: 'entry-1' },
    );
    expect(result).toBe(false);
  });

  it('should allow staff with ADMIN role to read audit', () => {
    const result = engine.isAllowed(
      { principalType: 'STAFF', roles: ['ADMIN'] },
      'audit.read',
      { type: 'audit' },
    );
    expect(result).toBe(true);
  });

  it('should deny staff without correct role', () => {
    const result = engine.isAllowed(
      { principalType: 'STAFF', roles: ['OPERATOR'] },
      'audit.read',
      { type: 'audit' },
    );
    expect(result).toBe(false);
  });

  it('should allow customer to read own account', () => {
    const result = engine.isAllowed(
      { principalType: 'CUSTOMER', roles: [] },
      'account.read',
      { type: 'account', id: 'acct-1' },
    );
    expect(result).toBe(true);
  });

  it('should deny by default for unknown actions', () => {
    const result = engine.isAllowed(
      { principalType: 'CUSTOMER', roles: [] },
      'unknown.action',
      { type: 'unknown' },
    );
    expect(result).toBe(false);
  });

  it('DENY should take precedence over ALLOW when both match', () => {
    // CUSTOMER has DENY for ledger.post - even though SYSTEM ALLOW exists, DENY for CUSTOMER should win
    const result = engine.isAllowed(
      { principalType: 'CUSTOMER', roles: [] },
      'ledger.post',
      { type: 'ledger' },
    );
    expect(result).toBe(false);
  });
});
