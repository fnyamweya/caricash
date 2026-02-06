const MIN_EFFECTIVE_DATE = '0000-00-00';

export function resolveEffectiveRecord<T extends { status?: string; effective_from?: string; effectiveFrom?: string }>(
  records: T[],
  now: Date = new Date(),
): T | null {
  const today = now.toISOString().slice(0, 10);
  const ordered = records
    .map((record) => ({
      record,
      effectiveFrom: record.effective_from ?? record.effectiveFrom ?? MIN_EFFECTIVE_DATE,
      version: (record as { version?: number }).version ?? 0,
    }))
    .sort((a, b) => {
      if (b.effectiveFrom > a.effectiveFrom) return 1;
      if (b.effectiveFrom < a.effectiveFrom) return -1;
      return b.version - a.version;
    });

  const match = ordered.find(({ record }) => {
    const status = record.status ?? 'ACTIVE';
    const effectiveFrom = record.effective_from ?? record.effectiveFrom ?? today;
    return status === 'ACTIVE' && effectiveFrom <= today;
  });

  return match ? match.record : null;
}
