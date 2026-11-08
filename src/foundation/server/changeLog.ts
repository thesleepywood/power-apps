import type { ChangeEntry } from '../shared/types';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export interface ChangeQuery {
  app?: string;
  recordId?: string;
  limit?: number;
}

/** Append-only, in-memory change log. Entries are frozen once written. */
export class ChangeLog {
  #entries: ChangeEntry[] = [];
  #seq = 0;

  append(entry: Omit<ChangeEntry, 'id'>): ChangeEntry {
    const full = deepFreeze({ id: `CHG-${String(++this.#seq).padStart(5, '0')}`, ...structuredClone(entry) });
    this.#entries.push(full);
    return full;
  }

  /** Newest first. */
  list(query: ChangeQuery = {}): ChangeEntry[] {
    let rows = this.#entries.filter(
      (e) => (!query.app || e.app === query.app) && (!query.recordId || e.recordId === query.recordId),
    );
    rows = rows.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1));
    return query.limit ? rows.slice(0, query.limit) : rows;
  }

  get size(): number {
    return this.#entries.length;
  }
}
