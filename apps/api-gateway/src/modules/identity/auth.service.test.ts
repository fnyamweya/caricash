import { AuthService } from './auth.service';
import { MAX_PIN_ATTEMPTS } from '@caricash/common';

jest.mock('@caricash/crypto', () => ({
  verifyPin: jest.fn(),
}));

const { verifyPin } = jest.requireMock('@caricash/crypto');

describe('AuthService lockouts', () => {
  it('locks account after max failed attempts', async () => {
    const principalRepo = {
      findByPhone: jest.fn().mockResolvedValue({
        id: 'user-1',
        principal_type: 'CUSTOMER',
        status: 'ACTIVE',
        pin_hash: 'hash',
        failed_pin_attempts: MAX_PIN_ATTEMPTS - 1,
      }),
      lockAccount: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
      unlock: jest.fn(),
    };
    const tokenService = {
      generateTokenPair: jest.fn(),
      storeRefreshToken: jest.fn(),
    };

    verifyPin.mockResolvedValue(false);

    const service = new AuthService(principalRepo as any, tokenService as any);

    await expect(service.login('+2461234567', '0000', { correlationId: 'corr' })).rejects.toThrow('Invalid credentials');
    expect(principalRepo.lockAccount).toHaveBeenCalledWith('user-1', expect.any(Number));
  });
});
