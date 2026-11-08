import type { ApiErrorBody } from '../shared/types';

export const USER_HEADER = 'x-keel-user';
const STORAGE_KEY = 'keel.userId';

export function storedUserId(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
}
export function storeUserId(id: string | null) {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const userId = storedUserId();
  if (userId) headers[USER_HEADER] = userId;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, 'network', "Can't reach the Keel server. Is `npm run demo` still running?");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiRequestError(res.status, err?.code ?? 'unknown', err?.message ?? `Request failed (${res.status}).`);
  }
  return data as T;
}
