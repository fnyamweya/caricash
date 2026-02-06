import { Injectable } from '@nestjs/common';
import { queryOne, queryMany } from '@caricash/db';

@Injectable()
export class StoresRepository {
  async createStore(params: { principalId: string; countryCode: string; storeNumber: string; legalName: string }) {
    return queryOne(
      `INSERT INTO stores (principal_id, country_code, store_number, legal_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.principalId, params.countryCode, params.storeNumber, params.legalName],
    );
  }

  async createTill(params: { storeId: string; tillNumber: string }) {
    return queryOne(
      `INSERT INTO tills (store_id, till_number)
       VALUES ($1, $2)
       RETURNING *`,
      [params.storeId, params.tillNumber],
    );
  }

  async findStoreByPrincipal(principalId: string) {
    return queryOne(
      'SELECT * FROM stores WHERE principal_id = $1',
      [principalId],
    );
  }

  async listTillsByStore(storeId: string) {
    return queryMany('SELECT * FROM tills WHERE store_id = $1 ORDER BY created_at', [storeId]);
  }
}
