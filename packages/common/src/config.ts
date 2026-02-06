export function resolveEffectiveRecord<T extends { status?: string; effective_from?: string; effectiveFrom?: string }>(
  records: T[],
  now: Date = new Date(),
): T | null {
  const today = now.toISOString().slice(0, 10);
  return (
    records.find((record) => {
      const status = record.status ?? 'ACTIVE';
      const effectiveFrom = record.effective_from ?? record.effectiveFrom ?? today;
      return status === 'ACTIVE' && effectiveFrom <= today;
    }) ?? null
  );
}
