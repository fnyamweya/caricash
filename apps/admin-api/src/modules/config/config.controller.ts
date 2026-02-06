import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('countries')
  async listCountries() {
    return this.configService.listCountries();
  }

  @Get('currencies')
  async listCurrencies() {
    return this.configService.listCurrencies();
  }

  @Get('kyc-requirements')
  async listKycRequirements(
    @Query('country') countryCode?: string,
    @Query('user_type') userType?: string,
    @Query('tier') tier?: string,
  ) {
    return this.configService.listKycRequirementSets({ countryCode, userType, tier });
  }

  @Get('permission-catalogs')
  async listPermissionCatalogs(@Query('country') countryCode?: string) {
    return this.configService.listPermissionCatalogs(countryCode);
  }

  @Get('policy-bundles')
  async listPolicyBundles(@Query('country') countryCode?: string) {
    return this.configService.listPolicyBundles(countryCode);
  }

  @Get('retention-policies')
  async listRetentionPolicies(@Query('country') countryCode?: string) {
    return this.configService.listRetentionPolicies(countryCode);
  }
}
