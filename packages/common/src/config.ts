export function resolveEffectiveRecord<T extends { status?: string; effective_from?: string; effectiveFrom?: string }>(
  records: T[],
  now: Date = new Date(),
): T | null {
  const today = now.toISOString().slice(0, 10);
  const ordered = [...records].sort((a, b) => {
    const aDate = a.effective_from ?? a.effectiveFrom ?? '';
    const bDate = b.effective_from ?? b.effectiveFrom ?? '';
    const dateCompare = bDate.localeCompare(aDate);
    if (dateCompare !== 0) return dateCompare;
    const aVersion = (a as { version?: number }).version ?? 0;
    const bVersion = (b as { version?: number }).version ?? 0;
    return bVersion - aVersion;
  });

  return (
    ordered.find((record) => {
      const status = record.status ?? 'ACTIVE';
      const effectiveFrom = record.effective_from ?? record.effectiveFrom ?? today;
      return status === 'ACTIVE' && effectiveFrom <= today;
    }) ?? null
  );
}
