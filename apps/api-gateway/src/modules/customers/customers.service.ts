import { Injectable } from '@nestjs/common';
import { IamRepository } from '../iam/iam.repository';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { RateLimitService } from '../security/rate-limit.service';
import { hashPin } from '@caricash/crypto';
import { ConflictError, ValidationError } from '@caricash/common';
import { KycService } from '../kyc/kyc.service';

@Injectable()
export class CustomersService {
  constructor(
    private readonly iamRepo: IamRepository,
    private readonly idempotency: IdempotencyService,
    private readonly rateLimit: RateLimitService,
    private readonly kycService: KycService,
  ) {}

  async signup(params: {
    countryCode: string;
    msisdn: string;
    pin: string;
    displayName: string;
    idempotencyKey: string;
    ip?: string;
    deviceId?: string;
  }) {
    const limiterKeys = [
      `signup:msisdn:${params.countryCode}:${params.msisdn}`,
      params.ip ? `signup:ip:${params.ip}` : null,
      params.deviceId ? `signup:device:${params.deviceId}` : null,
    ].filter(Boolean) as string[];

    for (const key of limiterKeys) {
      const result = await this.rateLimit.checkLimit({ key, limit: 5, windowSeconds: 300 });
      if (!result.allowed) {
        throw new ValidationError('Rate limit exceeded');
      }
    }

    return this.idempotency.execute({
      key: params.idempotencyKey,
      resourceType: 'customer.signup',
      request: params,
      handler: async () => {
        const existing = await this.iamRepo.findUserByMsisdn(params.countryCode, params.msisdn);
        if (existing) {
          return { response: { userId: existing.id }, resourceId: existing.id };
        }

        const pinHash = await hashPin(params.pin);
        const user = await this.iamRepo.createUser({
          countryCode: params.countryCode,
          msisdn: params.msisdn,
          displayName: params.displayName,
          pinHash,
        });

        const principal = await this.iamRepo.createPrincipal({
          principalType: 'CUSTOMER',
          countryCode: params.countryCode,
          displayName: params.displayName,
          externalRef: user.id,
        });

        const role = await this.iamRepo.findRoleByName('CUSTOMER_SELF');
        if (!role) {
          throw new ConflictError('Default customer role missing');
        }

        await this.iamRepo.createMembership({
          userId: user.id,
          principalId: principal.id,
          roleId: role.id,
        });

        await this.kycService.ensureProfile({
          userId: user.id,
          countryCode: params.countryCode,
          userType: 'CUSTOMER',
          tier: 'TIER_0',
        });

        return { response: { userId: user.id, principalId: principal.id }, resourceId: user.id };
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.iamRepo.findUserById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }
    return {
      id: user.id,
      displayName: user.display_name,
      msisdn: user.msisdn,
      countryCode: user.country_code,
      status: user.status,
    };
  }
}
