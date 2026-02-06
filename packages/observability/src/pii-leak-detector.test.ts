import { redactPII, scanForPiiKeys } from './pii';

describe('PII leak detector', () => {
  it('should redact known PII keys from payloads', () => {
    const payload = {
      name: 'Jane',
      dob: '1990-01-01',
      msisdn: '+2461234567',
      nested: { passport_number: 'X1234567' },
    };

    const redacted = redactPII(payload);
    const leakedKeys = scanForPiiKeys(JSON.stringify(redacted));
    expect(leakedKeys).toEqual([]);
  });

  it('should flag raw payloads that contain PII keys', () => {
    const raw = JSON.stringify({ msisdn: '+2461234567', address: 'Bridgetown' });
    const leaked = scanForPiiKeys(raw);
    expect(leaked).toContain('msisdn');
    expect(leaked).toContain('address');
  });
});
