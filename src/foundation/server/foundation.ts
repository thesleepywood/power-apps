import type { Snapshot } from '../shared/types';
import type { User } from '../shared/users';
import { ChangeLog } from './changeLog';
import { notFound } from './errors';

export interface CollectionSpec<T extends { id: string }> {
  app: string;
  recordType: string;
  label: (record: T) => string;
  /** What the change log may keep. Must strip or fully mask sensitive fields. */
  redact: (record: T) => Snapshot;
}

/** In-memory records for one app. Read-only from the outside: writes go through `Foundation.change`. */
export class Collection<T extends { id: string }> {
  readonly #items = new Map<string, T>();
  constructor(readonly spec: CollectionSpec<T>) {}

  get(id: string): T | undefined {
    const item = this.#items.get(id);
    return item ? structuredClone(item) : undefined;
  }

  require(id: string): T {
    const item = this.get(id);
    if (!item) throw notFound(`${this.spec.recordType} ${id}`);
    return item;
  }

  all(): T[] {
    return [...this.#items.values()].map((i) => structuredClone(i));
  }

  /** @internal Only Foundation.change may call this. */
  commit(record: T): void {
    this.#items.set(record.id, structuredClone(record));
  }
}

export interface ChangeInput<T> {
  /** Existing record id, or undefined to create a new record. */
  id?: string;
  action: string;
  summary: string;
  /** Receives a copy of the current record (undefined when creating) and returns the new version. May throw to abort. */
  apply: (current: T | undefined) => T;
  /** Override the timestamp (used to seed history). */
  at?: Date;
}

export class Foundation {
  readonly changeLog = new ChangeLog();

  constructor(readonly now: () => Date = () => new Date()) {}

  collection<T extends { id: string }>(spec: CollectionSpec<T>): Collection<T> {
    return new Collection(spec);
  }

  /**
   * The only way to change data. Applies the change and writes exactly one
   * change-log entry. If `apply` throws, nothing is stored and nothing is logged.
   */
  change<T extends { id: string }>(actor: User, collection: Collection<T>, input: ChangeInput<T>): T {
    const before = input.id ? collection.require(input.id) : undefined;
    const after = input.apply(before ? structuredClone(before) : undefined);
    const { spec } = collection;
    const entry = {
      at: (input.at ?? this.now()).toISOString(),
      actor: { id: actor.id, name: actor.name, role: actor.role },
      app: spec.app,
      recordType: spec.recordType,
      recordId: after.id,
      recordLabel: spec.label(after),
      action: input.action,
      summary: input.summary,
      before: before ? spec.redact(before) : null,
      after: spec.redact(after),
    };
    collection.commit(after);
    this.changeLog.append(entry);
    return structuredClone(after);
  }
}
