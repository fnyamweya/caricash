import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IDEMPOTENCY_KEY_HEADER } from '@caricash/common';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only enforce idempotency on POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const key = req.headers[IDEMPOTENCY_KEY_HEADER] as string;
      if (!key) {
        res.status(400).json({
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message: `Header '${IDEMPOTENCY_KEY_HEADER}' is required for ${req.method} requests`,
        });
        return;
      }
    }
    next();
  }
}
