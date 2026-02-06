import argon2 from 'argon2';

/**
 * Hash a PIN using argon2id with secure defaults.
 * argon2id is the recommended variant for password hashing.
 */
export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, {
    type: argon2.argon2id,
    memoryCost: 65536,    // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a PIN against an argon2id hash.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, pin);
}
