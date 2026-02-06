import { Injectable } from '@nestjs/common';
import { queryOne, queryMany } from '@caricash/db';

export interface StoreRow {
  id: string;
  principal_id: string;
  country_code: string;
  store_number: string;
  legal_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TillRow {
  id: string;
  store_id: string;
  till_number: string;
  status: string;
  created_at: string;
}

@Injectable()
export class StoresRepository {
  async createStore(params: { principalId: string; countryCode: string; storeNumber: string; legalName: string }): Promise<StoreRow | null> {
    return queryOne<StoreRow>(
      `INSERT INTO stores (principal_id, country_code, store_number, legal_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.principalId, params.countryCode, params.storeNumber, params.legalName],
    );
  }

  async createTill(params: { storeId: string; tillNumber: string }): Promise<TillRow | null> {
    return queryOne<TillRow>(
      `INSERT INTO tills (store_id, till_number)
       VALUES ($1, $2)
       RETURNING *`,
      [params.storeId, params.tillNumber],
    );
  }

  async findStoreByPrincipal(principalId: string): Promise<StoreRow | null> {
    return queryOne<StoreRow>(
      'SELECT * FROM stores WHERE principal_id = $1',
      [principalId],
    );
  }

  async listTillsByStore(storeId: string): Promise<TillRow[]> {
    return queryMany<TillRow>('SELECT * FROM tills WHERE store_id = $1 ORDER BY created_at', [storeId]);
  }
}
