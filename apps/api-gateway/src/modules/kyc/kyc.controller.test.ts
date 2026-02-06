import { KycController } from './kyc.controller';

const sampleRequirements = {
  requirementSet: { id: 'set-1', country_code: 'BB' },
  fields: [{ field_key: 'dob', required: true }],
  documents: [{ doc_type: 'ID', required: true, min_count: 1 }],
};

describe('KycController contracts', () => {
  it('returns requirements contract shape', async () => {
    const service = {
      getRequirements: jest.fn().mockResolvedValue(sampleRequirements),
    };
    const idempotency = { execute: jest.fn() };
    const controller = new KycController(service as any, idempotency as any);

    const result = await controller.getRequirements('BB', 'CUSTOMER', 'TIER_0');
    expect(result).toHaveProperty('requirementSet');
    expect(result).toHaveProperty('fields');
    expect(result).toHaveProperty('documents');
  });

  it('returns submit contract shape', async () => {
    const service = {
      submitKyc: jest.fn().mockResolvedValue({ profileId: 'profile-1', status: 'PENDING' }),
    };
    const idempotency = { execute: jest.fn().mockImplementation(async ({ handler }: any) => (await handler()).response) };
    const controller = new KycController(service as any, idempotency as any);

    const result = await controller.submitCustomerKyc(
      { countryCode: 'BB', tier: 'TIER_0', fields: {}, documents: [] },
      'user-1',
      'idem-1',
      'corr-1',
    );
    expect(result).toHaveProperty('profileId');
    expect(result).toHaveProperty('status');
  });

  it('returns status contract shape', async () => {
    const service = {
      getStatus: jest.fn().mockResolvedValue({ status: 'PENDING', missing: [], missingDocs: [] }),
    };
    const idempotency = { execute: jest.fn() };
    const controller = new KycController(service as any, idempotency as any);

    const result = await controller.getStatus('user-1', 'TIER_0');
    expect(result).toHaveProperty('status');
  });
});
