import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { KycCaseRoute, KycQueuePage } from '../kyc/client/KycQueuePage';
import { RefundsQueuePage, RefundsRoute } from '../refunds/client/RefundsQueuePage';
import { AppShell } from '../foundation/client/AppShell';
import { SessionProvider, useSession } from '../foundation/client/session';
import { SignInPage } from '../foundation/client/SignInPage';
import { Card, ErrorState, ToastProvider } from '../foundation/client/ui';
import { HomePage } from '../home/HomePage';

function RequireUser({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? <>{children}</> : <Navigate to="/sign-in" replace />;
}

function NotFound() {
  return (
    <Card>
      <ErrorState status={404} title="Page not found" message={<>There's nothing at this address. <Link to="/">Go to Home</Link></>} />
    </Card>
  );
}

export function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              element={
                <RequireUser>
                  <AppShell />
                </RequireUser>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="kyc" element={<KycQueuePage />} />
              <Route path="kyc/:id" element={<KycCaseRoute />} />
              <Route path="refunds" element={<RefundsQueuePage />} />
              <Route path="refunds/:id" element={<RefundsRoute />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SessionProvider>
  );
}
