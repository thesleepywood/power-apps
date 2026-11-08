/**
 * The app registry. Every app in Keel is one entry here; the sidebar, the
 * home page cards and the server's open counts are all driven from this list.
 *
 * Convention: a record inside an app lives at `${route}/${recordId}`.
 * To add an app: add an entry here, add its pages to the client router and
 * register its server module in `src/server/apps.ts`.
 */
export interface AppDefinition {
  id: string;
  name: string;
  route: string;
  /** Name of an icon in `src/foundation/client/icons.ts`. */
  icon: string;
  description: string;
}

export const APPS: AppDefinition[] = [
  {
    id: 'home',
    name: 'Home',
    route: '/',
    icon: 'home',
    description: 'Your day at a glance and the full record of every change.',
  },
  {
    id: 'kyc',
    name: 'KYC Review Queue',
    route: '/kyc',
    icon: 'identity',
    description: 'Identity checks to clear. High-risk cases need an Approver.',
  },
];

export function findApp(id: string): AppDefinition | undefined {
  return APPS.find((a) => a.id === id);
}

export function recordPath(appId: string, recordId: string): string | null {
  const app = findApp(appId);
  if (!app || app.route === '/') return null;
  return `${app.route}/${encodeURIComponent(recordId)}`;
}
