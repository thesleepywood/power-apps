import type { Role } from './roles';

/** The server's answer to "may this person do this?" — always with a reason when not. */
export type Decision = { allowed: true } | { allowed: false; code: string; reason: string };

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export type Snapshot = Record<string, unknown>;

export interface ChangeActor {
  id: string;
  name: string;
  role: Role;
}

export interface ChangeEntry {
  id: string;
  at: string;
  actor: ChangeActor;
  app: string;
  recordType: string;
  recordId: string;
  recordLabel: string;
  action: string;
  summary: string;
  before: Snapshot | null;
  after: Snapshot | null;
}

export interface AppSummary {
  id: string;
  name: string;
  route: string;
  icon: string;
  description: string;
  openCount: number | null;
  openLabel: string | null;
}

export interface HomeSummary {
  waitingOnYou: number;
  yourOpenRequests: number;
  changesLast24h: number;
  spotlight: Spotlight | null;
}

export interface Spotlight {
  app: string;
  recordId: string;
  /** Why this record: the viewer can act on it, they opened it, or it's simply the oldest open item. */
  reason: 'waiting_on_you' | 'yours' | 'oldest';
}
