import { Injectable } from '@nestjs/common';
import { ConfigRepository } from './config.repository';

@Injectable()
export class ConfigService {
  constructor(private readonly repo: ConfigRepository) {}

  async listCountries() {
    return this.repo.listCountries();
  }

  async listCurrencies() {
    return this.repo.listCurrencies();
  }

  async listKycRequirementSets(params: { countryCode?: string; userType?: string; tier?: string }) {
    return this.repo.listKycRequirementSets(params);
  }

  async listPermissionCatalogs(countryCode?: string) {
    return this.repo.listPermissionCatalogs(countryCode);
  }

  async listPolicyBundles(countryCode?: string) {
    return this.repo.listPolicyBundles(countryCode);
  }

  async listRetentionPolicies(countryCode?: string) {
    return this.repo.listRetentionPolicies(countryCode);
  }
}
