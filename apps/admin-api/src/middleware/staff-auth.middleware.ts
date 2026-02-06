import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Staff OAuth placeholder middleware.
 * In Phase 1, validates bearer token format and performs mock introspection.
 * In production, this would validate against an OAuth provider.
 */
@Injectable()
export class StaffAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token required' });
      return;
    }

    const token = authHeader.slice(7);
    if (!token || token.length < 10) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid bearer token' });
      return;
    }

    // Mock introspection: in Phase 1, accept any well-formed token
    // and assign default staff scopes
    (req as unknown as Record<string, unknown>).staffContext = {
      principalType: 'STAFF',
      roles: ['ADMIN'],
      scopes: ['audit.read', 'config.read', 'config.write'],
    };

    next();
  }
}
