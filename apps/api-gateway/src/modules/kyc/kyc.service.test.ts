import { KycService } from './kyc.service';

describe('KycService requirement resolution', () => {
  it('selects latest active effective requirement set', () => {
    const sets = [
      { status: 'ACTIVE', effective_from: '2025-01-01', version: 1 },
      { status: 'ACTIVE', effective_from: '2025-06-01', version: 2 },
      { status: 'DRAFT', effective_from: '2025-07-01', version: 3 },
    ];

    const resolved = KycService.resolveRequirementSet(sets, new Date('2025-06-15'));
    expect(resolved).toEqual(sets[1]);
  });

  it('returns null when no active set is effective', () => {
    const sets = [
      { status: 'DRAFT', effective_from: '2025-01-01', version: 1 },
    ];
    const resolved = KycService.resolveRequirementSet(sets, new Date('2025-01-02'));
    expect(resolved).toBeNull();
  });
});
