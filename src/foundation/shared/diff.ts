import type { Snapshot } from './types';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

function flatten(value: unknown, prefix: string, out: Record<string, unknown>) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (prefix) {
    out[prefix] = value;
  }
  return out;
}

/** Field-level differences between two change-log snapshots. */
export function diffSnapshots(before: Snapshot | null, after: Snapshot | null): FieldChange[] {
  const a = flatten(before ?? {}, '', {});
  const b = flatten(after ?? {}, '', {});
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return fields
    .filter((f) => JSON.stringify(a[f]) !== JSON.stringify(b[f]))
    .map((field) => ({ field, before: a[field], after: b[field] }));
}
