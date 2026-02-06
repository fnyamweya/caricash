import { Injectable } from '@nestjs/common';
import { IamRepository } from '../iam/iam.repository';
import { StoresRepository } from './stores.repository';
import { ConflictError, ValidationError } from '@caricash/common';
import { EventTypes } from '@caricash/events';
import { query } from '@caricash/db';
import { randomBytes } from 'crypto';

@Injectable()
export class StoresService {
  constructor(
    private readonly iamRepo: IamRepository,
    private readonly storesRepo: StoresRepository,
  ) {}

  async signup(params: { ownerUserId: string; countryCode: string; legalName: string; tillCount?: number; correlationId?: string }) {
    const role = await this.iamRepo.findRoleByName('MERCHANT_OWNER');
    if (!role) {
      throw new ConflictError('Merchant owner role missing');
    }

    const principal = await this.iamRepo.createPrincipal({
      principalType: 'MERCHANT',
      countryCode: params.countryCode,
      displayName: params.legalName,
    });

    const storeNumber = this.generateStoreNumber(params.countryCode);
    const store = await this.storesRepo.createStore({
      principalId: principal.id,
      countryCode: params.countryCode,
      storeNumber,
      legalName: params.legalName,
    });

    await this.iamRepo.createMembership({
      userId: params.ownerUserId,
      principalId: principal.id,
      roleId: role.id,
    });

    const tillCount = Math.max(params.tillCount ?? 1, 1);
    const tills = [];
    for (let i = 1; i <= tillCount; i++) {
      const tillNumber = `${storeNumber}-T${String(i).padStart(3, '0')}`;
      const till = await this.storesRepo.createTill({ storeId: store.id, tillNumber });
      tills.push(till);
    }

    await query(
      `INSERT INTO outbox_events (event_type, correlation_id, payload)
       VALUES ($1, $2, $3)`,
      [
        EventTypes.STORE_CREATED,
        params.correlationId ?? null,
        JSON.stringify({ storeId: store.id, principalId: principal.id, storeNumber: store.store_number, countryCode: store.country_code }),
      ],
    );

    return { store, tills };
  }

  async getStoreForUser(userId: string) {
    const memberships = await this.iamRepo.listMembershipsByUser(userId);
    const merchantMembership = memberships.find((membership) => membership.principal_type === 'MERCHANT');
    if (!merchantMembership) {
      throw new ValidationError('No merchant membership found');
    }
    const store = await this.storesRepo.findStoreByPrincipal(merchantMembership.principal_id);
    return { store, membership: merchantMembership };
  }

  async listTillsForPrincipal(principalId: string) {
    const store = await this.storesRepo.findStoreByPrincipal(principalId);
    if (!store) {
      throw new ValidationError('Store not found');
    }
    return this.storesRepo.listTillsByStore(store.id);
  }

  private generateStoreNumber(countryCode: string) {
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return `STO-${countryCode}-${suffix}`;
  }
}
