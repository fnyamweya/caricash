import { Injectable } from '@nestjs/common';
import { PrincipalRepository } from './principal.repository';
import { TokenService } from './token.service';
import { verifyPin } from '@caricash/crypto';
import { UnauthorizedError, AppError } from '@caricash/common';
import { MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MINUTES } from '@caricash/common';

@Injectable()
export class AuthService {
  constructor(
    private readonly principalRepo: PrincipalRepository,
    private readonly tokenService: TokenService,
  ) {}

  async login(
    phone: string,
    pin: string,
    context: { correlationId: string; userAgent?: string; ip?: string },
  ) {
    const principal = await this.principalRepo.findByPhone(phone);
    if (!principal) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (principal.status === 'LOCKED') {
      if (principal.locked_until && new Date(principal.locked_until) > new Date()) {
        throw new AppError('ACCOUNT_LOCKED', 'Account is locked. Try again later.', 423);
      }
      // Unlock if lockout period has passed
      await this.principalRepo.unlock(principal.id);
    }

    if (!principal.pin_hash) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await verifyPin(pin, principal.pin_hash);
    if (!valid) {
      const attempts = principal.failed_pin_attempts + 1;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        await this.principalRepo.lockAccount(principal.id, PIN_LOCKOUT_MINUTES);
      } else {
        await this.principalRepo.incrementFailedAttempts(principal.id);
      }
      throw new UnauthorizedError('Invalid credentials');
    }

    // Reset failed attempts on success
    if (principal.failed_pin_attempts > 0) {
      await this.principalRepo.resetFailedAttempts(principal.id);
    }

    const tokens = await this.tokenService.generateTokenPair(principal.id, principal.principal_type);
    await this.tokenService.storeRefreshToken(
      principal.id,
      tokens.refreshToken,
      context.userAgent,
      context.ip,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      principalId: principal.id,
      principalType: principal.principal_type,
    };
  }

  async refresh(refreshToken: string) {
    return this.tokenService.refreshAccessToken(refreshToken);
  }

  async logout(refreshToken: string) {
    await this.tokenService.revokeRefreshToken(refreshToken);
  }
}
