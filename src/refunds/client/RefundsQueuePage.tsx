import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, SearchX, Wallet } from 'lucide-react';
import { RefundRecord } from './RefundRecord';
import type { RefundList, RefundStatus, RefundView } from '../types';
import { api } from '../../foundation/client/api';
import { formatDate, formatDateTime, formatMoney } from '../../foundation/client/format';
import { useApi, useSession } from '../../foundation/client/session';
import { Badge, Card, ConfirmDialog, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, PermissionButton, StatusBadge, Tabs, useToast, type Column } from '../../foundation/client/ui';

type Filter = RefundStatus | 'all';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const matches = (f: Filter, r: RefundView) => f === 'all' || r.status === f;
const amount = (cents: number) => formatMoney(cents / 100);

const columns: Column<RefundView>[] = [
  {
    key: 'customer',
    header: 'Customer',
    render: (r) => (
      <div className="cell-stack">
        <span className="cell-strong">{r.customer}</span>
        <span className="cell-sub">{r.reason}</span>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    render: (r) => (
      <div className="cell-stack">
        <span className="cell-strong mono">{amount(r.amountCents)}</span>
        {r.needsApprover && <span className="cell-sub">Over $1,000</span>}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => (
      <div className="cell-stack">
        <span><StatusBadge status={r.status} /></span>
        {r.autoApproved && <span className="cell-sub">Automatically</span>}
      </div>
    ),
  },
  { key: 'by', header: 'Requested by', render: (r) => r.requestedBy.name },
  {
    key: 'requested',
    header: 'Requested',
    render: (r) => (
      <div className="cell-stack">
        <span title={formatDateTime(r.requestedAt)}>{formatDate(r.requestedAt)}</span>
        <span className="cell-sub mono">{r.id}</span>
      </div>
    ),
  },
];

const EMPTY_FORM = { customer: '', amount: '', summary: '' };

/** Dollars typed by a person → whole cents. The server validates the result. */
const toCents = (dollars: string) => {
  const n = Number(dollars.replace(/[$,\s]/g, ''));
  return dollars.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
};

export function RefundsQueuePage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [requesting, setRequesting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { data, error, loading, reload } = useApi<RefundList>('/apps/refunds/refunds');
  const { invalidate } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const rows = data?.rows ?? [];
  const shown = rows.filter((r) => matches(filter, r));
  const label = FILTERS.find((f) => f.value === filter)!.label.toLowerCase();
  const limit = amount(data?.autoApproveLimitCents ?? 100_000);
  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (reason: string) => {
    const created = await api<RefundView>('/apps/refunds/refunds', {
      method: 'POST',
      body: { customer: form.customer, amountCents: toCents(form.amount), reason, summary: form.summary },
    });
    invalidate();
    toast(created.autoApproved ? `${created.id} approved automatically` : `${created.id} sent to an Approver`);
    navigate(`/refunds/${created.id}`);
  };

  return (
    <>
      <PageHeader
        eyebrow={<><Wallet size={14} /> Refunds Dashboard</>}
        title="Refunds"
        subtitle={`Operators and Approvers request refunds. ${limit} or less is approved right away; anything more waits for an Approver. Nobody can approve their own request.`}
        actions={
          data && (
            <PermissionButton
              decision={data.actions.request}
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => {
                setForm(EMPTY_FORM);
                setRequesting(true);
              }}
            >
              Request refund
            </PermissionButton>
          )
        }
      />
      <Card padded={false}>
        <div className="card-toolbar">
          <Tabs value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: data ? rows.filter((r) => matches(f.value, r)).length : undefined }))} />
        </div>
        {loading && !data ? (
          <div className="card-body"><LoadingState /></div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} status={error.status} />
        ) : (
          <DataTable
            caption="Refunds"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/refunds/${r.id}`)}
            empty={
              <EmptyState
                icon={<SearchX size={22} />}
                title={filter === 'pending' ? 'Nothing waiting for an Approver' : `No ${label} refunds`}
                message={filter === 'pending' ? `Refunds over ${limit} show up here until an Approver decides them.` : 'Try another tab.'}
              />
            }
          />
        )}
      </Card>

      <ConfirmDialog
        open={requesting}
        title="Request a refund"
        body={
          <>
            <p>
              {limit} or less is approved as soon as you submit. Anything more goes to an Approver — someone other than you. <Badge tone="info">Logged under your name</Badge>
            </p>
            <div className="form-grid">
              <label className="field">
                <span className="field-label">Customer</span>
                <input value={form.customer} onChange={set('customer')} placeholder="Name or business" />
              </label>
              <label className="field">
                <span className="field-label">Amount (USD)</span>
                <input value={form.amount} onChange={set('amount')} placeholder="0.00" inputMode="decimal" />
              </label>
              <label className="field is-wide">
                <span className="field-label">
                  Summary<span className="field-optional"> (optional)</span>
                </span>
                <input value={form.summary} onChange={set('summary')} placeholder="What happened, for whoever decides it" />
              </label>
            </div>
          </>
        }
        confirmLabel="Submit request"
        note={{ label: 'Reason', placeholder: 'e.g. Duplicate card charge', required: true }}
        onConfirm={submit}
        onClose={() => setRequesting(false)}
      />
    </>
  );
}

export function RefundsRoute() {
  const { id = '' } = useParams();
  return <RefundRecord id={id} />;
}
