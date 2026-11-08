// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SessionProvider, useApi, useSession } from '../src/foundation/client/session';

function Probe() {
  const { signIn } = useSession();
  const { data, loading } = useApi<{ ssn: string }>('/record');
  return (
    <div>
      <span data-testid="ssn">{loading && !data ? 'loading' : data?.ssn}</span>
      <button onClick={() => signIn('u-grace')}>switch</button>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useApi after a persona switch', () => {
  it("never shows the previous person's response while the new one loads", async () => {
    localStorage.setItem('keel.userId', 'u-maya');
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const user = (init.headers as Record<string, string>)['x-keel-user'];
      if (user === 'u-grace') return new Promise<Response>(() => {});
      return Promise.resolve(new Response(JSON.stringify({ ssn: '•••-••-4401' }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('•••-••-4401')).toBeInTheDocument();

    await act(async () => screen.getByText('switch').click());
    expect(screen.getByTestId('ssn')).toHaveTextContent('loading');
    expect(screen.queryByText('•••-••-4401')).toBeNull();
  });
});
