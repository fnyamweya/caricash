import { MerchantAccessService } from './merchant-access.service';

describe('MerchantAccessService', () => {
  it('assigns user when policy allows', async () => {
    const iamRepo = {
      findMembershipByUserAndPrincipal: jest.fn().mockResolvedValue({ role_name: 'MERCHANT_OWNER', member_attributes: {} }),
      findRoleByName: jest.fn().mockResolvedValue({ id: 'role-1' }),
      createMembership: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      updateMembershipAttributes: jest.fn(),
      updateMembershipRole: jest.fn(),
      listMembershipsByPrincipal: jest.fn(),
    };
    const policyService = {
      evaluate: jest.fn().mockReturnValue({ allow: true, reasonCodes: [], obligations: [] }),
    };

    const service = new MerchantAccessService(iamRepo as any, policyService as any);

    const result = await service.assignUser({
      principalId: 'principal-1',
      actorUserId: 'actor-1',
      userId: 'user-1',
      roleName: 'MERCHANT_OWNER',
    });

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error('Expected membership');
    }
    expect(result.id).toBe('membership-1');
    expect(iamRepo.createMembership).toHaveBeenCalled();
  });
});
