import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { KycService } from './kyc.service';
import { CORRELATION_ID_HEADER, IDEMPOTENCY_KEY_HEADER } from '@caricash/common';
import { IdempotencyService } from '../idempotency/idempotency.service';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('requirements')
  async getRequirements(
    @Query('country') countryCode: string,
    @Query('user_type') userType: string,
    @Query('tier') tier: string,
  ) {
    return this.kycService.getRequirements({ countryCode, userType, tier });
  }

  @Post('customers/submit')
  async submitCustomerKyc(
    @Body() dto: { countryCode: string; tier: string; fields: Record<string, unknown>; documents: Array<{ docType: string; fileRef: string; fileHash: string; metadata?: Record<string, unknown> }> },
    @Headers('x-user-id') userId: string,
    @Headers(IDEMPOTENCY_KEY_HEADER) idempotencyKey: string,
    @Headers(CORRELATION_ID_HEADER) correlationId: string,
  ) {
    return this.idempotency.execute({
      key: idempotencyKey,
      resourceType: 'kyc.submit',
      request: dto,
      handler: async () => {
        const response = await this.kycService.submitKyc({
          userId,
          countryCode: dto.countryCode,
          userType: 'CUSTOMER',
          tier: dto.tier,
          fields: dto.fields,
          documents: dto.documents,
          correlationId,
        });
        return { response, resourceId: response.profileId };
      },
    });
  }

  @Get('status')
  async getStatus(
    @Headers('x-user-id') userId: string,
    @Query('tier') tier: string,
  ) {
    return this.kycService.getStatus({ userId, tier: tier ?? 'TIER_0' });
  }

  @Get('explain')
  async explain(
    @Headers('x-user-id') userId: string,
    @Query('tier') tier: string,
  ) {
    return this.kycService.explain({ userId, tier: tier ?? 'TIER_0' });
  }
}
