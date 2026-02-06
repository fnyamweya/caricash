import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('countries')
  async listCountries(): Promise<Record<string, unknown>[]> {
    return this.configService.listCountries();
  }

  @Get('currencies')
  async listCurrencies(): Promise<Record<string, unknown>[]> {
    return this.configService.listCurrencies();
  }

  @Get('kyc-requirements')
  async listKycRequirements(
    @Query('country') countryCode?: string,
    @Query('user_type') userType?: string,
    @Query('tier') tier?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.configService.listKycRequirementSets({ countryCode, userType, tier });
  }

  @Get('permission-catalogs')
  async listPermissionCatalogs(@Query('country') countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.configService.listPermissionCatalogs(countryCode);
  }

  @Get('policy-bundles')
  async listPolicyBundles(@Query('country') countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.configService.listPolicyBundles(countryCode);
  }

  @Get('retention-policies')
  async listRetentionPolicies(@Query('country') countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.configService.listRetentionPolicies(countryCode);
  }
}
