import { hashPin, verifyPin } from './pin';

describe('PIN hashing', () => {
  it('should hash and verify a PIN', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(pin);
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const valid = await verifyPin(pin, hash);
    expect(valid).toBe(true);
  });

  it('should reject wrong PIN', async () => {
    const hash = await hashPin('1234');
    const valid = await verifyPin('5678', hash);
    expect(valid).toBe(false);
  });

  it('should produce different hashes for same PIN (due to salt)', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).not.toBe(hash2);
  });
});
