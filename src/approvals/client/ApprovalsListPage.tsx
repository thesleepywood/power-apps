import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, SearchX, Stamp } from 'lucide-react';
import { ApprovalRecord } from './ApprovalRecord';
import { NewRequestDialog } from './NewRequestDialog';
import type { RequestStatus, SignOffRequestView } from '../types';
import { formatMoney, timeAgo, formatDateTime } from '../../foundation/client/format';
import { useApi, useSession } from '../../foundation/client/session';
import { Avatar, Card, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, PermissionButton, StatusBadge, Tabs, useToast, type Column } from '../../foundation/client/ui';
import type { Decision } from '../../foundation/shared/types';

type Filter = RequestStatus | 'all';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'all', label: 'All' },
];

const columns: Column<SignOffRequestView>[] = [
  {
    key: 'request',
    header: 'Request',
    render: (r) => (
      <div className="cell-stack">
        <span className="cell-strong">{r.title}</span>
        <span className="cell-sub mono">{r.id} · {r.kind}</span>
      </div>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (r) => (
      <div className="cell-stack">
        <span>{r.customerName}</span>
        <span className="cell-sub mono" title="Masked by the server">SSN {r.customerSsn}</span>
      </div>
    ),
  },
  { key: 'amount', header: 'Amount', align: 'right', render: (r) => <span className="mono">{formatMoney(r.amount)}</span> },
  {
    key: 'by',
    header: 'Requested by',
    render: (r) => (
      <span className="person-inline">
        <Avatar initials={r.requestedBy.name.split(' ').map((p) => p[0]).join('')} role={r.requestedBy.role} size="sm" />
        {r.requestedBy.name}
      </span>
    ),
  },
  { key: 'opened', header: 'Opened', render: (r) => <span title={formatDateTime(r.requestedAt)}>{timeAgo(r.requestedAt)}</span> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

export function ApprovalsListPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi<{ rows: SignOffRequestView[]; canCreate: Decision }>('/apps/approvals/requests');
  const { invalidate } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const rows = data?.rows ?? [];
  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const count = (f: Filter) => (f === 'all' ? rows.length : rows.filter((r) => r.status === f).length);

  return (
    <>
      <PageHeader
        eyebrow={<><Stamp size={14} /> Approvals</>}
        title="Sign-off requests"
        subtitle="Anything that needs an Approver lands here. Nobody can sign off on a request they opened."
        actions={data && <PermissionButton decision={data.canCreate} variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New request</PermissionButton>}
      />
      <Card padded={false}>
        <div className="card-toolbar">
          <Tabs value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: data ? count(f.value) : undefined }))} />
        </div>
        {loading && !data ? (
          <div className="card-body"><LoadingState /></div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} status={error.status} />
        ) : (
          <DataTable
            caption="Sign-off requests"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/approvals/${r.id}`)}
            empty={
              <EmptyState
                icon={<SearchX size={22} />}
                title={filter === 'pending' ? 'Nothing waiting for sign-off' : `No ${filter} requests`}
                message={filter === 'pending' ? 'New requests from Operators and Approvers will show up here.' : 'Try another tab.'}
              />
            }
          />
        )}
      </Card>
      <NewRequestDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(r) => {
          setCreating(false);
          invalidate();
          toast(`${r.id} opened`);
          navigate(`/approvals/${r.id}`);
        }}
      />
    </>
  );
}

export function ApprovalDetailRoute() {
  const { id = '' } = useParams();
  return <ApprovalRecord id={id} />;
}
