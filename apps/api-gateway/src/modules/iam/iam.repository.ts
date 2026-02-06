import { Injectable } from '@nestjs/common';
import { queryOne, queryMany } from '@caricash/db';

@Injectable()
export class IamRepository {
  async findUserByMsisdn(countryCode: string, msisdn: string) {
    return queryOne(
      'SELECT * FROM users WHERE country_code = $1 AND msisdn = $2',
      [countryCode, msisdn],
    );
  }

  async findUserById(userId: string) {
    return queryOne('SELECT * FROM users WHERE id = $1', [userId]);
  }

  async createUser(params: {
    countryCode: string;
    msisdn: string;
    displayName: string;
    pinHash: string;
    metadata?: Record<string, unknown>;
  }) {
    return queryOne(
      `INSERT INTO users (principal_type, status, display_name, phone, msisdn, country_code, pin_hash, metadata)
       VALUES ('CUSTOMER', 'ACTIVE', $1, $2, $2, $3, $4, $5)
       RETURNING *`,
      [params.displayName, params.msisdn, params.countryCode, params.pinHash, JSON.stringify(params.metadata ?? {})],
    );
  }

  async createStaffUser(params: {
    displayName: string;
    countryCode: string;
    email?: string;
    externalId?: string;
  }) {
    return queryOne(
      `INSERT INTO users (principal_type, status, display_name, email, country_code, external_id, metadata)
       VALUES ('STAFF', 'ACTIVE', $1, $2, $3, $4, '{}')
       RETURNING *`,
      [params.displayName, params.email ?? null, params.countryCode, params.externalId ?? null],
    );
  }

  async createPrincipal(params: {
    principalType: string;
    countryCode: string;
    displayName: string;
    externalRef?: string;
    metadata?: Record<string, unknown>;
  }) {
    return queryOne(
      `INSERT INTO principals (principal_type, country_code, display_name, external_ref, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [params.principalType, params.countryCode, params.displayName, params.externalRef ?? null, JSON.stringify(params.metadata ?? {})],
    );
  }

  async createMembership(params: {
    userId: string;
    principalId: string;
    roleId: string;
    memberAttributes?: Record<string, unknown>;
    deviceBindingRequired?: boolean;
  }) {
    return queryOne(
      `INSERT INTO memberships (user_id, principal_id, role_id, member_attributes, device_binding_required)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        params.userId,
        params.principalId,
        params.roleId,
        JSON.stringify(params.memberAttributes ?? {}),
        params.deviceBindingRequired ?? false,
      ],
    );
  }

  async listMembershipsByPrincipal(principalId: string) {
    return queryMany(
      `SELECT m.*, u.display_name, u.msisdn
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.principal_id = $1`,
      [principalId],
    );
  }

  async listMembershipsByUser(userId: string) {
    return queryMany(
      `SELECT m.*, p.principal_type, p.country_code\n       FROM memberships m\n       JOIN principals p ON p.id = m.principal_id\n       WHERE m.user_id = $1`,
      [userId],
    );
  }

  async listRoles(scope: string) {
    return queryMany('SELECT * FROM roles WHERE scope = $1', [scope]);
  }

  async createRole(params: { name: string; description?: string; scope: string }) {
    return queryOne(
      `INSERT INTO roles (name, description, scope)\n       VALUES ($1, $2, $3)\n       RETURNING *`,
      [params.name, params.description ?? null, params.scope],
    );
  }

  async findRoleByName(name: string) {
    return queryOne('SELECT * FROM roles WHERE name = $1', [name]);
  }

  async findMembershipByUserAndPrincipal(userId: string, principalId: string) {
    return queryOne(
      `SELECT m.*, r.name as role_name\n       FROM memberships m\n       JOIN roles r ON r.id = m.role_id\n       WHERE m.user_id = $1 AND m.principal_id = $2`,
      [userId, principalId],
    );
  }

  async updateMembershipAttributes(params: { membershipId: string; attributes: Record<string, unknown> }) {
    return queryOne(
      `UPDATE memberships SET member_attributes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(params.attributes), params.membershipId],
    );
  }

  async updateMembershipRole(params: { membershipId: string; roleId: string }) {
    return queryOne(
      `UPDATE memberships SET role_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [params.roleId, params.membershipId],
    );
  }
}
