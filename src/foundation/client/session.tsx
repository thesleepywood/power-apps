import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { findUser, type User } from '../shared/users';
import { api, ApiRequestError, storedUserId, storeUserId } from './api';

interface SessionValue {
  user: User | null;
  signIn: (userId: string) => void;
  signOut: () => void;
  /** Bumps after every successful change so all live data refetches. */
  version: number;
  invalidate: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => findUser(storedUserId()) ?? null);
  const [version, setVersion] = useState(0);

  const signIn = useCallback((userId: string) => {
    storeUserId(userId);
    setUser(findUser(userId) ?? null);
    setVersion((v) => v + 1);
  }, []);
  const signOut = useCallback(() => {
    storeUserId(null);
    setUser(null);
  }, []);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(() => ({ user, signIn, signOut, version, invalidate }), [user, signIn, signOut, version, invalidate]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export interface ApiState<T> {
  data: T | undefined;
  error: ApiRequestError | null;
  loading: boolean;
  reload: () => void;
}

/**
 * GETs `path` and refetches whenever any change is made anywhere in the app.
 * Data is tagged with the person it was fetched for, so after a persona switch
 * nobody sees the previous person's (differently masked) response.
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const { version, user, signOut } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ data?: T; error: ApiRequestError | null; loading: boolean; userId: string | null }>({
    error: null,
    loading: true,
    userId,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => (s.userId === userId ? { ...s, loading: true } : { error: null, loading: true, userId }));
    api<T>(path)
      .then((data) => live && setState({ data, error: null, loading: false, userId }))
      .catch((error: ApiRequestError) => {
        if (!live) return;
        if (error.status === 401) signOut();
        setState({ data: undefined, error, loading: false, userId });
      });
    return () => {
      live = false;
    };
  }, [path, version, nonce, userId, signOut]);

  const current = state.userId === userId;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : null,
    loading: current ? state.loading : true,
    reload: () => setNonce((n) => n + 1),
  };
}
