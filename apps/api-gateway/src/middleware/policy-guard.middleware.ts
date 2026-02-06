import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PolicyEngine, PolicyDecision } from '@caricash/policy';
import { createLogger } from '@caricash/observability';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger({ name: 'policy-guard' });

/**
 * Obligation Registry: loads and validates policy obligations
 */
interface ObligationSchema {
  description: string;
  severity: string;
  params_schema: Record<string, unknown>;
  enforcement_handler: string;
  evidence_required: string[];
  issued_by: string[];
}

interface ObligationRegistry {
  version: string;
  obligations: Record<string, ObligationSchema>;
}

/**
 * PolicyGuard Middleware
 * 
 * Enforces policy obligations returned by PolicyEngine.
 * Validates evidence headers and ensures all obligations are satisfied.
 * 
 * CRITICAL: This is the enforcement layer. Obligations are MANDATORY, not advisory.
 */
@Injectable()
export class PolicyGuardMiddleware implements NestMiddleware {
  private registry: ObligationRegistry;

  constructor(private readonly policyEngine: PolicyEngine) {
    // Load obligation registry
    const registryPath = path.join(process.cwd(), 'policies/obligations/registry.json');
    if (fs.existsSync(registryPath)) {
      this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      logger.info({ obligationCount: Object.keys(this.registry.obligations).length }, 'Obligation registry loaded');
    } else {
      logger.warn('Obligation registry not found, obligations will be treated as errors');
      this.registry = { version: '0.0.0', obligations: {} };
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Extract subject, action, resource from request
    // This is a simplified example; real implementation would extract from JWT, route, etc.
    
    const subject = {
      principalType: (req as any).user?.principalType ?? 'ANONYMOUS',
      principalId: (req as any).user?.id,
      roles: (req as any).user?.roles ?? [],
      attributes: (req as any).user?.attributes ?? {},
    };

    const action = this.extractAction(req);
    const resource = this.extractResource(req);
    const context = {
      countryCode: (req as any).user?.countryCode ?? 'BB',
      channel: req.headers['x-channel'] as string ?? 'API',
      ip: req.ip,
    };

    const decision = this.policyEngine.evaluate(subject, action, resource, context);

    if (!decision.allow) {
      logger.warn({ subject, action, resource, reasonCodes: decision.reasonCodes }, 'Policy denied');
      throw new ForbiddenException({
        error: 'PolicyDenied',
        reasonCodes: decision.reasonCodes,
      });
    }

    // Enforce obligations
    if (decision.obligations.length > 0) {
      try {
        this.enforceObligations(decision.obligations, req);
      } catch (err) {
        logger.warn({ subject, action, obligations: decision.obligations, error: (err as Error).message }, 'Obligation enforcement failed');
        throw new ForbiddenException({
          error: 'ObligationNotSatisfied',
          obligations: decision.obligations,
          message: (err as Error).message,
        });
      }
    }

    // Store decision in request for audit
    (req as any).policyDecision = decision;

    next();
  }

  private extractAction(req: Request): string {
    // Map HTTP method + route to action
    // Example: POST /api/v1/ledger/post -> ledger.post
    const method = req.method;
    const path = req.path;
    
    // Simplified mapping; real implementation would be more sophisticated
    if (path.includes('/ledger/post')) return 'ledger.post';
    if (path.includes('/ledger/reverse')) return 'ledger.reverse';
    if (path.includes('/audit')) return 'audit.read';
    if (path.includes('/config')) return 'config.write';
    
    return `${method.toLowerCase()}.${path.replace(/\//g, '.')}`;
  }

  private extractResource(req: Request): { type: string; id?: string; attributes?: Record<string, unknown> } {
    // Extract resource from route params
    const path = req.path;
    
    if (path.includes('/ledger')) return { type: 'ledger' };
    if (path.includes('/audit')) return { type: 'audit' };
    if (path.includes('/config')) return { type: 'config' };
    
    return { type: 'unknown' };
  }

  private enforceObligations(obligations: string[], req: Request): void {
    for (const obligation of obligations) {
      const schema = this.registry.obligations[obligation];
      
      if (!schema) {
        throw new Error(`Unknown obligation: ${obligation}. Not in registry.`);
      }

      // Check evidence headers
      for (const evidenceHeader of schema.evidence_required) {
        const headerValue = req.headers[evidenceHeader.toLowerCase()];
        if (!headerValue) {
          throw new Error(`Missing evidence header: ${evidenceHeader} for obligation ${obligation}`);
        }
        
        // Validate evidence (placeholder - real implementation would verify signatures, tokens, etc.)
        this.validateEvidence(obligation, evidenceHeader, headerValue as string);
      }

      // Call enforcement handler
      this.callEnforcementHandler(schema.enforcement_handler, obligation, req);
    }
  }

  private validateEvidence(obligation: string, headerName: string, value: string): void {
    // Placeholder for evidence validation
    // Real implementation would:
    // - Verify JWT signatures for MFA assertions
    // - Validate device binding tokens
    // - Check ticket references against ticketing system
    // - Verify approval request IDs
    
    if (!value || value.length === 0) {
      throw new Error(`Invalid evidence for ${obligation}: ${headerName} is empty`);
    }
    
    // For now, just check non-empty
    logger.debug({ obligation, headerName, valueLength: value.length }, 'Evidence validated (stub)');
  }

  private callEnforcementHandler(handlerName: string, obligation: string, req: Request): void {
    // Placeholder for enforcement handler dispatch
    // Real implementation would have handler registry and call appropriate handler
    
    logger.debug({ handlerName, obligation }, 'Enforcement handler called (stub)');
    
    // Example handlers (stubs):
    switch (handlerName) {
      case 'MfaEnforcementHandler':
        // Verify MFA assertion token
        break;
      case 'DeviceBindingEnforcementHandler':
        // Verify device binding
        break;
      case 'MakerCheckerEnforcementHandler':
        // Verify approval request exists and is approved
        break;
      case 'KycTierEnforcementHandler':
        // Check user KYC tier
        break;
      default:
        logger.warn({ handlerName }, 'No enforcement handler implementation');
        // For now, treat unknown handlers as errors (fail-safe)
        throw new Error(`Enforcement handler not implemented: ${handlerName}`);
    }
  }
}
