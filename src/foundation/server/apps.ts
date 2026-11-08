import type { Router } from 'express';
import type { Spotlight } from '../shared/types';
import type { User } from '../shared/users';
import type { Foundation } from './foundation';

/** Server half of an app listed in `src/registry.ts`. */
export interface ServerApp {
  id: string;
  /** Mounted at `/api/apps/<id>`, behind the identity middleware. */
  router: Router;
  /** Count of open items, shown in the sidebar and on home cards. */
  openCount(): number;
  /** e.g. "waiting for sign-off". */
  openLabel: string;
  /** Items this person could act on right now. */
  waitingOn?(user: User): number;
  /** Open items this person started. */
  openedBy?(user: User): number;
  /** The record this person should look at next, if any. */
  spotlight?(user: User): Omit<Spotlight, 'app'> | null;
}

export type ServerAppFactory = (foundation: Foundation) => ServerApp;
