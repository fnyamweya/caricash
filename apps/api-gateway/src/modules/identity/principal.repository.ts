import { Injectable } from '@nestjs/common';
import { query, queryOne } from '@caricash/db';

interface PrincipalRow {
  id: string;
  principal_type: string;
  status: string;
  phone: string;
  pin_hash: string | null;
  failed_pin_attempts: number;
  locked_until: string | null;
  display_name: string;
}

@Injectable()
export class PrincipalRepository {
  async findByPhone(phone: string): Promise<PrincipalRow | null> {
    return queryOne<PrincipalRow>(
      'SELECT id, principal_type, status, phone, pin_hash, failed_pin_attempts, locked_until, display_name FROM principals WHERE phone = $1',
      [phone],
    );
  }

  async findById(id: string): Promise<PrincipalRow | null> {
    return queryOne<PrincipalRow>(
      'SELECT id, principal_type, status, phone, pin_hash, failed_pin_attempts, locked_until, display_name FROM principals WHERE id = $1',
      [id],
    );
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await query(
      'UPDATE principals SET failed_pin_attempts = failed_pin_attempts + 1, updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await query(
      'UPDATE principals SET failed_pin_attempts = 0, updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async lockAccount(id: string, minutes: number): Promise<void> {
    await query(
      `UPDATE principals SET status = 'LOCKED', locked_until = NOW() + ($1 || ' minutes')::INTERVAL, failed_pin_attempts = 0, updated_at = NOW() WHERE id = $2`,
      [String(minutes), id],
    );
  }

  async unlock(id: string): Promise<void> {
    await query(
      `UPDATE principals SET status = 'ACTIVE', locked_until = NULL, failed_pin_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
