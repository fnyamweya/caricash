import { Injectable } from '@nestjs/common';
import { queryMany } from '@caricash/db';

@Injectable()
export class ConfigRepository {
  async listCountries(): Promise<Record<string, unknown>[]> {
    return queryMany(
      `SELECT c.code, c.name, c.is_active,
              array_agg(json_build_object('code', cc.currency_code, 'is_default', cc.is_default)) as currencies
       FROM countries c
       LEFT JOIN country_currencies cc ON cc.country_code = c.code
       GROUP BY c.code, c.name, c.is_active
       ORDER BY c.name`,
    );
  }

  async listCurrencies(): Promise<Record<string, unknown>[]> {
    return queryMany(
      'SELECT code, name, decimals, is_active FROM currencies ORDER BY code',
    );
  }
}
