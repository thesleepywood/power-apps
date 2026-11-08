import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, Inbox, ListChecks, Minus, ScrollText, Sparkles } from 'lucide-react';
import { RECORD_VIEWS } from '../client/recordViews';
import { appIcon } from '../foundation/client/icons';
import { formatDateTime, greeting, timeAgo } from '../foundation/client/format';
import { useApi, useSession } from '../foundation/client/session';
import { Avatar, Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, RoleBadge, Tabs, type Column } from '../foundation/client/ui';
import { ROLES } from '../foundation/shared/roles';
import type { AppSummary, ChangeEntry, HomeSummary, Spotlight } from '../foundation/shared/types';
import { findApp, recordPath } from '../registry';

const PAGE = 12;

const SPOTLIGHT_TITLE: Record<Spotlight['reason'], string> = {
  waiting_on_you: 'Up next for you',
  yours: 'Your open request',
  oldest: 'Oldest open request',
};

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | undefined; hint: string }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value ?? '–'}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-hint">{hint}</div>
      </div>
    </div>
  );
}

const changeColumns: Column<ChangeEntry>[] = [
  { key: 'when', header: 'When', width: '130px', render: (e) => <span title={formatDateTime(e.at)} className="nowrap">{timeAgo(e.at)}</span> },
  {
    key: 'app',
    header: 'App',
    width: '140px',
    render: (e) => {
      const app = findApp(e.app);
      const Icon = appIcon(app?.icon ?? '');
      return (
        <span className="app-chip">
          <Icon size={14} />
          {app?.name ?? e.app}
        </span>
      );
    },
  },
  {
    key: 'record',
    header: 'Record',
    render: (e) => (
      <div className="cell-stack">
        <span className="cell-strong">{e.recordLabel.split(' · ').slice(1).join(' · ') || e.recordLabel}</span>
        <span className="cell-sub mono">{e.recordId}</span>
      </div>
    ),
  },
  { key: 'what', header: 'What happened', render: (e) => <span className={`what what-${e.action}`}>{e.summary}</span> },
  {
    key: 'who',
    header: 'Who',
    render: (e) => (
      <span className="person-inline">
        <Avatar initials={e.actor.name.split(' ').map((p) => p[0]).join('')} role={e.actor.role} size="sm" />
        <span className="cell-stack">
          <span>{e.actor.name}</span>
          <span className="cell-sub">{ROLES[e.actor.role].label}</span>
        </span>
      </span>
    ),
  },
];

export function HomePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const home = useApi<HomeSummary>('/home');
  const apps = useApi<AppSummary[]>('/apps');
  const changes = useApi<ChangeEntry[]>('/changes');
  const [appFilter, setAppFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => (changes.data ?? []).filter((e) => appFilter === 'all' || e.app === appFilter), [changes.data, appFilter]);
  if (!user) return null;
  const role = ROLES[user.role];
  const appCards = (apps.data ?? []).filter((a) => a.id !== 'home');
  const appsWithChanges = [...new Set((changes.data ?? []).map((e) => e.app))];
  const spot = home.data?.spotlight;
  const Spotlight = spot ? RECORD_VIEWS[spot.app] : undefined;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="home">
      <PageHeader
        eyebrow={<><CalendarClock size={14} /> {today}</>}
        title={`${greeting()}, ${user.firstName}`}
        subtitle={
          <>
            <RoleBadge role={user.role} /> {role.summary}
          </>
        }
      />

      <div className="home-top">
        <Card title={`What ${role.plural} can do`} className="role-card">
          <ul className="can-list">
            {role.can.map((c) => (
              <li key={c} className="can">
                <Check size={15} /> {c}
              </li>
            ))}
            {role.cannot.map((c) => (
              <li key={c} className="cannot">
                <Minus size={15} /> {c}
              </li>
            ))}
          </ul>
          <p className="fine">The server enforces this on every request — the screen just explains it.</p>
        </Card>
        <div className="stats">
          <Stat
            icon={<Inbox size={18} />}
            label="Waiting on you"
            value={home.data?.waitingOnYou}
            hint={user.role === 'approver' ? 'Requests you can sign off' : `Sign-off is for Approvers`}
          />
          <Stat icon={<ListChecks size={18} />} label="Your open requests" value={home.data?.yourOpenRequests} hint="Opened by you, still pending" />
          <Stat icon={<ScrollText size={18} />} label="Changes, last 24 hours" value={home.data?.changesLast24h} hint="Across every app" />
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Apps</h2>
        {apps.error ? (
          <Card><ErrorState message={apps.error.message} onRetry={apps.reload} /></Card>
        ) : (
          <div className="app-cards">
            {appCards.map((app) => {
              const Icon = appIcon(app.icon);
              return (
                <Link key={app.id} to={app.route} className="app-card">
                  <span className="app-card-icon"><Icon size={20} /></span>
                  <span className="app-card-body">
                    <span className="app-card-name">{app.name}</span>
                    <span className="app-card-desc">{app.description}</span>
                  </span>
                  <span className="app-card-count">
                    <strong>{app.openCount ?? '—'}</strong>
                    <span>open</span>
                  </span>
                  <ArrowRight size={16} className="app-card-arrow" />
                </Link>
              );
            })}
            <div className="app-card is-placeholder">
              <span className="app-card-icon"><Sparkles size={20} /></span>
              <span className="app-card-body">
                <span className="app-card-name">More apps coming</span>
                <span className="app-card-desc">KYC Review Queue and Refunds Dashboard plug into the same foundation.</span>
              </span>
            </div>
          </div>
        )}
      </section>

      {spot && Spotlight && (
        <section className="section">
          <h2 className="section-title">{SPOTLIGHT_TITLE[spot.reason]}</h2>
          <Spotlight id={spot.recordId} compact />
        </section>
      )}

      <section className="section">
        <Card
          padded={false}
          title={
            <span className="title-with-sub">
              Full record
              <span className="card-sub">Every change across all apps, newest first</span>
            </span>
          }
          actions={
            <Tabs
              value={appFilter}
              onChange={(v) => {
                setAppFilter(v);
                setShowAll(false);
              }}
              options={[{ value: 'all', label: 'All apps' }, ...appsWithChanges.map((id) => ({ value: id, label: findApp(id)?.name ?? id }))]}
            />
          }
        >
          {changes.loading && !changes.data ? (
            <div className="card-body"><LoadingState /></div>
          ) : changes.error ? (
            <ErrorState message={changes.error.message} onRetry={changes.reload} status={changes.error.status} />
          ) : (
            <>
              <DataTable
                caption="Full record of changes"
                columns={changeColumns}
                rows={showAll ? filtered : filtered.slice(0, PAGE)}
                rowKey={(e) => e.id}
                onRowClick={(e) => {
                  const to = recordPath(e.app, e.recordId);
                  if (to) navigate(to);
                }}
                empty={<EmptyState icon={<ScrollText size={22} />} title="No changes yet" message="When anyone changes anything, it shows up here." />}
              />
              {filtered.length > PAGE && (
                <div className="table-foot">
                  <span className="muted">
                    Showing {showAll ? filtered.length : PAGE} of {filtered.length} changes
                  </span>
                  <button type="button" className="link" onClick={() => setShowAll((s) => !s)}>
                    {showAll ? 'Show fewer' : 'Show all'}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
