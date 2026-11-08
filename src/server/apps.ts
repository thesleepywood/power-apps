import { approvalsApp } from '../approvals/server';
import type { ServerAppFactory } from '../foundation/server/apps';

/** Server modules for apps in `src/registry.ts`. */
export const SERVER_APPS: ServerAppFactory[] = [approvalsApp];
