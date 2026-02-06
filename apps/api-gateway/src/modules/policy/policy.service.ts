import { Injectable } from '@nestjs/common';
import { PolicyEngine, PolicyDecision, PolicySubject, PolicyResource, PolicyContext } from '@caricash/policy';
import * as path from 'path';

@Injectable()
export class PolicyService {
  private readonly engine: PolicyEngine;

  constructor() {
    this.engine = new PolicyEngine();
    const policiesDir = path.resolve(process.cwd(), 'policies');
    this.engine.loadFromDirectory(policiesDir);
  }

  evaluate(subject: PolicySubject, action: string, resource: PolicyResource, context: PolicyContext = {}): PolicyDecision {
    return this.engine.evaluate(subject, action, resource, context);
  }
}
