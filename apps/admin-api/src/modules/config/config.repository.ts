import { Injectable } from '@nestjs/common';
import { queryMany } from '@caricash/db';

type ConfigRow = Record<string, unknown>;

@Injectable()
export class ConfigRepository {
  async listCountries(): Promise<ConfigRow[]> {
    return queryMany<ConfigRow>(
      `SELECT c.code, c.name, c.is_active,
              array_agg(json_build_object('code', cc.currency_code, 'is_default', cc.is_default)) as currencies
       FROM countries c
       LEFT JOIN country_currencies cc ON cc.country_code = c.code
       GROUP BY c.code, c.name, c.is_active
       ORDER BY c.name`,
    );
  }

  async listCurrencies(): Promise<ConfigRow[]> {
    return queryMany<ConfigRow>(
      'SELECT code, name, decimals, is_active FROM currencies ORDER BY code',
    );
  }

  async listKycRequirementSets(params: { countryCode?: string; userType?: string; tier?: string }): Promise<ConfigRow[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params.countryCode) {
      values.push(params.countryCode);
      conditions.push(`country_code = $${values.length}`);
    }
    if (params.userType) {
      values.push(params.userType);
      conditions.push(`user_type = $${values.length}`);
    }
    if (params.tier) {
      values.push(params.tier);
      conditions.push(`tier = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return queryMany<ConfigRow>(`SELECT * FROM kyc_requirement_sets ${where} ORDER BY effective_from DESC, version DESC`, values);
  }

  async listPermissionCatalogs(countryCode?: string): Promise<ConfigRow[]> {
    if (!countryCode) {
      return queryMany<ConfigRow>('SELECT * FROM permission_catalogs ORDER BY effective_from DESC, version DESC');
    }
    return queryMany<ConfigRow>('SELECT * FROM permission_catalogs WHERE country_code = $1 ORDER BY effective_from DESC, version DESC', [countryCode]);
  }

  async listPolicyBundles(countryCode?: string): Promise<ConfigRow[]> {
    if (!countryCode) {
      return queryMany<ConfigRow>('SELECT * FROM policy_bundles ORDER BY effective_from DESC, version DESC');
    }
    return queryMany<ConfigRow>('SELECT * FROM policy_bundles WHERE country_code = $1 ORDER BY effective_from DESC, version DESC', [countryCode]);
  }

  async listRetentionPolicies(countryCode?: string): Promise<ConfigRow[]> {
    if (!countryCode) {
      return queryMany<ConfigRow>('SELECT * FROM data_retention_policies ORDER BY country_code, data_type');
    }
    return queryMany<ConfigRow>('SELECT * FROM data_retention_policies WHERE country_code = $1 ORDER BY data_type', [countryCode]);
  }
}
