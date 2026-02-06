import { createHash } from 'crypto';
import { PostingLine } from '@caricash/common';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `"${key}":${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeLedgerEntryHash(fields: {
  subledger: string;
  description: string;
  reference: string;
  businessDay: string;
  idempotencyKey: string;
  reversedEntryId?: string | null;
  metadata?: Record<string, unknown>;
  lines: PostingLine[];
}): string {
  const metadataText = stableStringify(fields.metadata ?? {});
  const linesText = stableStringify(fields.lines ?? []);
  const reversed = fields.reversedEntryId ?? '';
  const canonical = `${fields.subledger}|${fields.description}|${fields.reference}|${fields.businessDay}|${fields.idempotencyKey}|${reversed}|${metadataText}|${linesText}`;
  return createHash('sha256').update(canonical).digest('hex');
}
