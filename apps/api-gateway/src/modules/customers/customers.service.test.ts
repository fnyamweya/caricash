import { CustomersService } from './customers.service';

class FakeIdempotency {
  async execute<T>(params: { handler: () => Promise<{ response: T; resourceId?: string }> }) {
    const result = await params.handler();
    return result.response;
  }
}

describe('CustomersService', () => {
  it('creates user and membership on signup', async () => {
    const iamRepo = {
      findUserByMsisdn: jest.fn().mockResolvedValue(null),
      createUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
      createPrincipal: jest.fn().mockResolvedValue({ id: 'principal-1' }),
      findRoleByName: jest.fn().mockResolvedValue({ id: 'role-1' }),
      createMembership: jest.fn().mockResolvedValue({ id: 'membership-1' }),
    };
    const rateLimit = { checkLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 4 }) };
    const kycService = { ensureProfile: jest.fn().mockResolvedValue({ id: 'profile-1' }) };

    const service = new CustomersService(iamRepo as any, new FakeIdempotency() as any, rateLimit as any, kycService as any);

    const result = await service.signup({
      countryCode: 'BB',
      msisdn: '+2461234567',
      pin: '1234',
      displayName: 'Jane Doe',
      idempotencyKey: 'idem-1',
    });

    expect(result.userId).toBe('user-1');
    expect(result.principalId).toBe('principal-1');
    expect(iamRepo.createMembership).toHaveBeenCalled();
  });
});
