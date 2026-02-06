import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { query, queryOne } from '@caricash/db';
import { UnauthorizedError } from '@caricash/common';
import { JWT_ACCESS_TTL_SECONDS, JWT_REFRESH_TTL_SECONDS } from '@caricash/common';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';
  }

  async generateTokenPair(principalId: string, principalType: string): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: principalId, type: principalType },
      this.jwtSecret,
      { expiresIn: JWT_ACCESS_TTL_SECONDS },
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_ACCESS_TTL_SECONDS,
    };
  }

  async storeRefreshToken(
    principalId: string,
    refreshToken: string,
    userAgent?: string,
    ip?: string,
  ): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

    await query(
      `INSERT INTO refresh_tokens (principal_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5::inet)`,
      [principalId, tokenHash, expiresAt, userAgent ?? null, ip ?? null],
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const row = await queryOne<{ id: string; principal_id: string; expires_at: Date }>(
      `SELECT rt.id, rt.principal_id, rt.expires_at
       FROM refresh_tokens rt
       JOIN principals p ON p.id = rt.principal_id
       WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW() AND p.status = 'ACTIVE'`,
      [tokenHash],
    );

    if (!row) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const principal = await queryOne<{ principal_type: string }>(
      'SELECT principal_type FROM principals WHERE id = $1',
      [row.principal_id],
    );

    const accessToken = jwt.sign(
      { sub: row.principal_id, type: principal?.principal_type },
      this.jwtSecret,
      { expiresIn: JWT_ACCESS_TTL_SECONDS },
    );

    return { accessToken, expiresIn: JWT_ACCESS_TTL_SECONDS };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash],
    );
  }

  verifyAccessToken(token: string): { sub: string; type: string } {
    try {
      return jwt.verify(token, this.jwtSecret) as { sub: string; type: string };
    } catch {
      throw new UnauthorizedError('Invalid access token');
    }
  }
}
