import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Undo2, X } from 'lucide-react';
import type { SignOffRequestView } from '../types';
import { api } from '../../foundation/client/api';
import { formatDateTime, formatMoney, timeAgo } from '../../foundation/client/format';
import { useApi, useSession } from '../../foundation/client/session';
import { ActionBar, Avatar, Card, ChangeHistory, ConfirmDialog, ErrorState, FieldList, LoadingState, RecordPage, RoleBadge, StatusBadge, useToast } from '../../foundation/client/ui';
import { ROLES } from '../../foundation/shared/roles';

type Pending = 'approve' | 'reject' | 'withdraw' | null;

function Person({ person }: { person: SignOffRequestView['requestedBy'] }) {
  return (
    <span className="person-inline">
      <Avatar initials={person.name.split(' ').map((p) => p[0]).join('')} role={person.role} size="sm" />
      {person.name}
      <RoleBadge role={person.role} />
    </span>
  );
}

export function ApprovalRecord({ id, compact = false }: { id: string; compact?: boolean }) {
  const { data: r, error, loading, reload } = useApi<SignOffRequestView>(`/apps/approvals/requests/${encodeURIComponent(id)}`);
  const { user, invalidate } = useSession();
  const toast = useToast();
  const [dialog, setDialog] = useState<Pending>(null);

  if (loading && !r) return <Card><LoadingState rows={6} /></Card>;
  if (error || !r) {
    return (
      <Card>
        <ErrorState
          status={error?.status}
          title={error?.status === 404 ? `Request ${id} doesn't exist` : undefined}
          message={error?.status === 404 ? <>It may have been mistyped. <Link to="/approvals">Back to Approvals</Link></> : error?.message}
          onRetry={error?.status === 404 ? undefined : reload}
        />
      </Card>
    );
  }

  const act = (path: string, message: string) => async (note: string) => {
    await api(`/apps/approvals/requests/${encodeURIComponent(r.id)}/${path}`, { method: 'POST', body: { note } });
    invalidate();
    toast(message);
  };

  const isMine = r.requestedBy.id === user?.id;
  const pending = r.status === 'pending';
  const what = (
    <p>
      <strong>{r.title}</strong> for {r.customerName}
      {r.amount !== null && <> ({formatMoney(r.amount)})</>}. This is recorded in the change log under your name.
    </p>
  );

  const decisionNotice = !pending && (
    <div className={`notice notice-${r.status}`}>
      <StatusBadge status={r.status} />
      <span>
        {r.status === 'withdrawn' ? 'Withdrawn by ' : `${r.status === 'approved' ? 'Approved' : 'Rejected'} by `}
        <strong>{r.decidedBy?.name ?? r.requestedBy.name}</strong>
        {r.decidedAt && <> · {formatDateTime(r.decidedAt)}</>}
        {r.decisionNote && <> — “{r.decisionNote}”</>}
      </span>
    </div>
  );

  const selfNotice = pending && isMine && user?.role === 'approver' && (
    <div className="notice notice-info">
      You opened this request, so another Approver has to sign off on it.
    </div>
  );

  return (
    <>
      <RecordPage
        compact={compact}
        breadcrumb={compact ? undefined : { label: 'Approvals', to: '/approvals' }}
        id={r.id}
        title={r.title}
        status={<StatusBadge status={r.status} />}
        meta={
          <>
            <span>{r.kind}</span>
            <span>·</span>
            <span>
              Opened by {r.requestedBy.name} ({ROLES[r.requestedBy.role].label}) {timeAgo(r.requestedAt)}
            </span>
          </>
        }
        actions={
          pending && (
            <ActionBar
              actions={[
                { label: 'Withdraw', decision: r.actions.withdraw, onClick: () => setDialog('withdraw'), icon: <Undo2 size={15} />, hideWhenDenied: true },
                { label: 'Reject', decision: r.actions.reject, onClick: () => setDialog('reject'), variant: 'danger', icon: <X size={15} /> },
                { label: 'Approve', decision: r.actions.approve, onClick: () => setDialog('approve'), variant: 'primary', icon: <Check size={15} /> },
              ]}
            />
          )
        }
        notice={decisionNotice || selfNotice || null}
        aside={
          <Card
            title="Change history"
            actions={compact ? <Link className="link" to={`/approvals/${r.id}`}>Open full record <ArrowRight size={14} /></Link> : undefined}
          >
            <ChangeHistory app="approvals" recordId={r.id} limit={compact ? 3 : undefined} />
          </Card>
        }
      >
        <Card title="Details">
          <FieldList
            fields={[
              { label: 'Customer', value: r.customerName },
              { label: 'Customer SSN', value: r.customerSsn, sensitive: true },
              { label: 'Type', value: r.kind },
              { label: 'Amount', value: r.amount === null ? '—' : <span className="mono">{formatMoney(r.amount)}</span> },
              { label: 'Requested by', value: <Person person={r.requestedBy} /> },
              { label: 'Opened', value: formatDateTime(r.requestedAt) },
              { label: 'Reason', value: r.reason, wide: true },
              ...(compact ? [] : [{ label: 'Summary', value: r.summary || '—', wide: true }]),
              ...(r.decidedBy && r.status !== 'withdrawn'
                ? [
                    { label: 'Decided by', value: <Person person={r.decidedBy} /> },
                    { label: 'Decided', value: r.decidedAt ? formatDateTime(r.decidedAt) : '—' },
                  ]
                : []),
            ]}
          />
        </Card>
      </RecordPage>

      <ConfirmDialog
        open={dialog === 'approve'}
        title={`Approve ${r.id}?`}
        body={what}
        confirmLabel="Approve request"
        note={{ label: 'Note', placeholder: 'Anything the team should know' }}
        onConfirm={act('approve', `${r.id} approved`)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title={`Reject ${r.id}?`}
        body={what}
        tone="danger"
        confirmLabel="Reject request"
        note={{ label: 'Why are you rejecting it?', placeholder: 'The requester will see this', required: true }}
        onConfirm={act('reject', `${r.id} rejected`)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'withdraw'}
        title={`Withdraw ${r.id}?`}
        body={<p>It will leave the Approvers' queue. This can't be undone, but you can open a new request.</p>}
        confirmLabel="Withdraw request"
        onConfirm={act('withdraw', `${r.id} withdrawn`)}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

