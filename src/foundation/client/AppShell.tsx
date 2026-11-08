import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, LogOut } from 'lucide-react';
import { ROLE_ORDER, ROLES } from '../shared/roles';
import type { AppSummary } from '../shared/types';
import { USERS } from '../shared/users';
import { appIcon } from './icons';
import { useApi, useSession } from './session';
import { Avatar, RoleBadge } from './ui';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'is-light' : ''}`}>
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
        <rect width="32" height="32" rx="8" className="logo-mark" />
        <path d="M9 22 16 8l7 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 24h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </svg>
      <span className="logo-word">Keel</span>
    </span>
  );
}

function UserSwitcher() {
  const { user, signIn, signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) return null;
  return (
    <div className="switcher" ref={ref}>
      {open && (
        <div className="switcher-menu" role="menu">
          <div className="switcher-heading">Switch person</div>
          {ROLE_ORDER.map((role) => (
            <div key={role} className="switcher-group">
              <div className="switcher-role">{ROLES[role].plural}</div>
              {USERS.filter((u) => u.role === role).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="menuitem"
                  className="switcher-item"
                  onClick={() => {
                    signIn(u.id);
                    setOpen(false);
                  }}
                >
                  <Avatar initials={u.initials} role={u.role} size="sm" />
                  <span className="switcher-name">{u.name}</span>
                  {u.id === user.id && <Check size={15} className="switcher-check" />}
                </button>
              ))}
            </div>
          ))}
          <button
            type="button"
            role="menuitem"
            className="switcher-item switcher-signout"
            onClick={() => {
              signOut();
              navigate('/sign-in');
            }}
          >
            <LogOut size={15} />
            <span>Back to sign-in</span>
          </button>
        </div>
      )}
      <button type="button" className="user-card" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar initials={user.initials} role={user.role} />
        <span className="user-card-text">
          <span className="user-card-name">{user.name}</span>
          <span className="user-card-role">
            <RoleBadge role={user.role} />
          </span>
        </span>
        <ChevronsUpDown size={16} className="user-card-chevron" />
      </button>
    </div>
  );
}

export function AppShell() {
  const { user } = useSession();
  const { data: apps } = useApi<AppSummary[]>('/apps');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo light />
          <span className="env-chip">Demo</span>
        </div>
        <nav className="sidebar-nav" aria-label="Apps">
          <div className="sidebar-section">Apps</div>
          {(apps ?? []).map((app) => {
            const Icon = appIcon(app.icon);
            return (
              <NavLink key={app.id} to={app.route} end={app.route === '/'} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}>
                <Icon size={18} />
                <span className="nav-label">{app.name}</span>
                {app.openCount !== null && (
                  <span className={`nav-count ${app.openCount === 0 ? 'is-zero' : ''}`} title={`${app.openCount} ${app.openLabel}`}>
                    {app.openCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        {user && (
          <div className="sidebar-role">
            <div className="sidebar-section">Signed in as</div>
            <p className="sidebar-role-text">
              <strong>{ROLES[user.role].label}.</strong> {ROLES[user.role].summary}
            </p>
          </div>
        )}
        <UserSwitcher />
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
