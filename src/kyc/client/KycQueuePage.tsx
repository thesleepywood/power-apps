import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScanFace, SearchX } from 'lucide-react';
import { KycCaseRecord } from './KycCaseRecord';
import { RiskBadge } from './RiskBadge';
import type { KycCaseView, KycStatus } from '../types';
import { formatDate, formatDateTime } from '../../foundation/client/format';
import { useApi } from '../../foundation/client/session';
import { Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge, Tabs, type Column } from '../../foundation/client/ui';

type Filter = 'open' | KycStatus | 'all';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'waiting', label: 'Waiting for approver' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const matches = (f: Filter, c: KycCaseView) => f === 'all' || (f === 'open' ? c.status === 'pending' || c.status === 'waiting' : c.status === f);

const columns: Column<KycCaseView>[] = [
  {
    key: 'customer',
    header: 'Customer',
    render: (c) => (
      <div className="cell-stack">
        <span className="cell-strong">{c.customerName}</span>
        <span className="cell-sub">{c.reviewReason}</span>
      </div>
    ),
  },
  { key: 'ssn', header: 'SSN', render: (c) => <span className="mono" title="Masked by the server">{c.ssn}</span> },
  { key: 'risk', header: 'Risk', render: (c) => <RiskBadge risk={c.risk} /> },
  { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
  {
    key: 'opened',
    header: 'Opened',
    render: (c) => (
      <div className="cell-stack">
        <span title={formatDateTime(c.openedAt)}>{formatDate(c.openedAt)}</span>
        <span className="cell-sub mono">{c.id}</span>
      </div>
    ),
  },
];

export function KycQueuePage() {
  const [filter, setFilter] = useState<Filter>('open');
  const { data, error, loading, reload } = useApi<{ rows: KycCaseView[] }>('/apps/kyc/cases');
  const navigate = useNavigate();

  const rows = data?.rows ?? [];
  const shown = rows.filter((c) => matches(filter, c));
  const label = FILTERS.find((f) => f.value === filter)!.label.toLowerCase();

  return (
    <>
      <PageHeader
        eyebrow={<><ScanFace size={14} /> KYC Review Queue</>}
        title="Identity checks"
        subtitle="Operators and Approvers clear low-risk cases. High-risk cases go to Waiting for approver, and only an Approver can approve them."
      />
      <Card padded={false}>
        <div className="card-toolbar">
          <Tabs value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: data ? rows.filter((c) => matches(f.value, c)).length : undefined }))} />
        </div>
        {loading && !data ? (
          <div className="card-body"><LoadingState /></div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} status={error.status} />
        ) : (
          <DataTable
            caption="KYC cases"
            columns={columns}
            rows={shown}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/kyc/${c.id}`)}
            empty={
              <EmptyState
                icon={<SearchX size={22} />}
                title={filter === 'open' ? 'Queue is clear' : `No ${label} cases`}
                message={filter === 'open' ? 'Every case has a decision. New cases will show up here.' : 'Try another tab.'}
              />
            }
          />
        )}
      </Card>
    </>
  );
}

export function KycCaseRoute() {
  const { id = '' } = useParams();
  return <KycCaseRecord id={id} />;
}
