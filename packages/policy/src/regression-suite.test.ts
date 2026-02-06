import { PolicyEngine } from './engine';
import * as fs from 'fs';
import * as path from 'path';

interface RegressionCase {
  name: string;
  subject: { principalType: string; roles: string[]; principalId?: string; attributes?: Record<string, unknown> };
  action: string;
  resource: { type: string; id?: string; attributes?: Record<string, unknown> };
  expected: boolean;
  obligations?: string[];
}

describe('Policy regression suite', () => {
  it('should satisfy all regression cases', () => {
    const engine = new PolicyEngine();
    const policiesDir = path.resolve(__dirname, '../../../policies');
    engine.loadFromDirectory(policiesDir);

    const suitePath = path.resolve(policiesDir, 'regression-suite.json');
    const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8')) as { cases: RegressionCase[] };

    for (const testCase of suite.cases) {
      const decision = engine.evaluate(testCase.subject, testCase.action, testCase.resource, {});
      expect(decision.allow).toBe(testCase.expected);
      if (testCase.obligations?.length) {
        for (const obligation of testCase.obligations) {
          expect(decision.obligations).toContain(obligation);
        }
      }
    }
  });
});
