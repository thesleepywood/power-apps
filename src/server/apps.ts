import { kycApp } from '../kyc/server';
import { refundsApp } from '../refunds/server';
import type { ServerAppFactory } from '../foundation/server/apps';

/** Server modules for apps in `src/registry.ts`. */
export const SERVER_APPS: ServerAppFactory[] = [kycApp, refundsApp];
