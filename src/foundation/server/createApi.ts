import express from 'express';
import { APPS } from '../../registry';
import type { AppSummary, HomeSummary } from '../shared/types';
import { USERS } from '../shared/users';
import type { ServerApp, ServerAppFactory } from './apps';
import { ApiError } from './errors';
import { Foundation } from './foundation';
import { currentUser, errorHandler, identify } from './http';

export interface ApiOptions {
  apps: ServerAppFactory[];
  now?: () => Date;
}

export function createApi(options: ApiOptions) {
  const foundation = new Foundation(options.now);
  const serverApps: ServerApp[] = options.apps.map((make) => make(foundation));
  for (const sa of serverApps) {
    if (!APPS.some((a) => a.id === sa.id)) throw new Error(`Server app "${sa.id}" is missing from src/registry.ts`);
  }

  const api = express.Router();
  api.use(express.json());

  // Public: who can you sign in as.
  api.get('/users', (_req, res) => {
    res.json(USERS);
  });

  api.use(identify);

  api.get('/session', (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  api.get('/apps', (_req, res) => {
    const summaries: AppSummary[] = APPS.map((app) => {
      const sa = serverApps.find((s) => s.id === app.id);
      return { ...app, openCount: sa ? sa.openCount() : null, openLabel: sa?.openLabel ?? null };
    });
    res.json(summaries);
  });

  api.get('/home', (_req, res) => {
    const user = currentUser(res);
    const since = new Date(foundation.now().getTime() - 24 * 3_600_000).toISOString();
    const rank = { waiting_on_you: 0, yours: 1, oldest: 2 } as const;
    const spotlights = serverApps
      .flatMap((sa) => {
        const s = sa.spotlight?.(user);
        return s ? [{ ...s, app: sa.id }] : [];
      })
      .sort((a, b) => rank[a.reason] - rank[b.reason]);
    const summary: HomeSummary = {
      waitingOnYou: serverApps.reduce((n, sa) => n + (sa.waitingOn?.(user) ?? 0), 0),
      yourOpenRequests: serverApps.reduce((n, sa) => n + (sa.openedBy?.(user) ?? 0), 0),
      changesLast24h: foundation.changeLog.list().filter((e) => e.at >= since).length,
      spotlight: spotlights[0] ?? null,
    };
    res.json(summary);
  });

  api.get('/changes', (req, res) => {
    const q = (k: string) => (typeof req.query[k] === 'string' ? (req.query[k] as string) : undefined);
    const limit = q('limit') ? Math.min(Math.max(Number(q('limit')) || 0, 1), 500) : undefined;
    res.json(foundation.changeLog.list({ app: q('app'), recordId: q('recordId'), limit }));
  });

  for (const sa of serverApps) api.use(`/apps/${sa.id}`, sa.router);

  api.use((req) => {
    throw new ApiError(404, 'not_found', `No API route for ${req.method} ${req.path}`);
  });
  api.use(errorHandler);

  return { router: api, foundation, serverApps };
}

/** A standalone Express app serving the API under /api (used by tests and the demo server). */
export function createApiApp(options: ApiOptions) {
  const { router, foundation, serverApps } = createApi(options);
  const app = express();
  app.use('/api', router);
  return { app, foundation, serverApps };
}
