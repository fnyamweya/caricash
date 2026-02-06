import { Injectable } from '@nestjs/common';
import { ConfigRepository } from './config.repository';

@Injectable()
export class ConfigService {
  constructor(private readonly repo: ConfigRepository) {}

  async listCountries(): Promise<Record<string, unknown>[]> {
    return this.repo.listCountries();
  }

  async listCurrencies(): Promise<Record<string, unknown>[]> {
    return this.repo.listCurrencies();
  }

  async listKycRequirementSets(params: { countryCode?: string; userType?: string; tier?: string }): Promise<Record<string, unknown>[]> {
    return this.repo.listKycRequirementSets(params);
  }

  async listPermissionCatalogs(countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.repo.listPermissionCatalogs(countryCode);
  }

  async listPolicyBundles(countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.repo.listPolicyBundles(countryCode);
  }

  async listRetentionPolicies(countryCode?: string): Promise<Record<string, unknown>[]> {
    return this.repo.listRetentionPolicies(countryCode);
  }
}
