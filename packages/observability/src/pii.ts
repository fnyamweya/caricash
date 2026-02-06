const PII_KEYS = [
  'national_id',
  'passport_number',
  'passport_no',
  'dob',
  'date_of_birth',
  'birth_date',
  'address',
  'msisdn',
  'phone',
  'email',
  'pin',
  'pin_hash',
  'document',
  'document_number',
  'file_ref',
  'file_hash',
];

export const PII_REDACTION_PATHS = PII_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `**.${key}`,
]);

export function redactPII(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPII(item));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.includes(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactPII(val);
      }
    }
    return output;
  }
  return value;
}

export function getPiiKeys(): string[] {
  return [...PII_KEYS];
}

function collectPiiKeys(value: unknown, results: Set<string>) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectPiiKeys(item, results));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.includes(key) && val !== '[REDACTED]') {
        results.add(key);
      }
      collectPiiKeys(val, results);
    }
  }
}

export function scanForPiiKeys(payload: string): string[] {
  try {
    const data = JSON.parse(payload);
    const results = new Set<string>();
    collectPiiKeys(data, results);
    return Array.from(results);
  } catch {
    const lower = payload.toLowerCase();
    return PII_KEYS.filter((key) => lower.includes(key.toLowerCase()));
  }
}
