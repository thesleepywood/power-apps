import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import type { Person, RefundView } from '../types';
import { api } from '../../foundation/client/api';
import { formatDateTime, formatMoney, timeAgo } from '../../foundation/client/format';
import { useApi, useSession } from '../../foundation/client/session';
import { ActionBar, Avatar, Badge, Card, ChangeHistory, ConfirmDialog, ErrorState, FieldList, LoadingState, RecordPage, RoleBadge, StatusBadge, useToast } from '../../foundation/client/ui';
import { ROLES } from '../../foundation/shared/roles';

const amount = (cents: number) => formatMoney(cents / 100);

function PersonInline({ person }: { person: Person }) {
  return (
    <span className="person-inline">
      <Avatar initials={person.name.split(' ').map((p) => p[0]).join('')} role={person.role} size="sm" />
      {person.name}
      <RoleBadge role={person.role} />
    </span>
  );
}

export function RefundRecord({ id, compact = false }: { id: string; compact?: boolean }) {
  const { data: r, error, loading, reload } = useApi<RefundView>(`/apps/refunds/refunds/${encodeURIComponent(id)}`);
  const { user, invalidate } = useSession();
  const toast = useToast();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);

  if (loading && !r) return <Card><LoadingState rows={6} /></Card>;
  if (error || !r) {
    return (
      <Card>
        <ErrorState
          status={error?.status}
          title={error?.status === 404 ? `Refund ${id} doesn't exist` : undefined}
          message={error?.status === 404 ? <>It may have been mistyped. <Link to="/refunds">Back to the Refunds Dashboard</Link></> : error?.message}
          onRetry={error?.status === 404 ? undefined : reload}
        />
      </Card>
    );
  }

  const act = (path: string, message: string) => async (note: string) => {
    await api(`/apps/refunds/refunds/${encodeURIComponent(r.id)}/${path}`, { method: 'POST', body: { note } });
    invalidate();
    toast(message);
  };

  const open = r.status === 'pending';
  const isMine = r.requestedBy.id === user?.id;

  const decisionNotice = !open && (
    <div className={`notice notice-${r.status}`}>
      <StatusBadge status={r.status} />
      {r.autoApproved ? (
        <span>
          Approved automatically on request — {amount(r.amountCents)} is within the $1,000 limit
          {r.decidedAt && <> · {formatDateTime(r.decidedAt)}</>}
        </span>
      ) : (
        <span>
          {r.status === 'approved' ? 'Approved' : 'Rejected'} by <strong>{r.decidedBy?.name}</strong>
          {r.decidedAt && <> · {formatDateTime(r.decidedAt)}</>}
          {r.decisionNote && <> — “{r.decisionNote}”</>}
        </span>
      )}
    </div>
  );

  const selfNotice = open && isMine && (
    <div className="notice notice-info">You requested this refund, so {user?.role === 'approver' ? 'another' : 'an'} Approver has to decide it.</div>
  );

  const waitingNotice = open && (
    <div className="notice notice-info">
      <Badge tone="warning">Over $1,000</Badge>
      <span>This refund waits here until an Approver who didn't request it approves or rejects it.</span>
    </div>
  );

  const what = (
    <p>
      <strong>{amount(r.amountCents)}</strong> to <strong>{r.customer}</strong> ({r.id}) — {r.reason}. Requested by {r.requestedBy.name}. This is recorded in the change log under your name.
    </p>
  );

  return (
    <>
      <RecordPage
        compact={compact}
        breadcrumb={compact ? undefined : { label: 'Refunds Dashboard', to: '/refunds' }}
        id={r.id}
        title={
          <>
            {amount(r.amountCents)} <span className="muted">to {r.customer}</span>
          </>
        }
        status={
          <>
            <StatusBadge status={r.status} />
            {r.needsApprover && <Badge tone="warning">Over $1,000</Badge>}
          </>
        }
        meta={
          <span>
            Requested by {r.requestedBy.name} ({ROLES[r.requestedBy.role].label}) {timeAgo(r.requestedAt)}
          </span>
        }
        actions={
          open && (
            <ActionBar
              actions={[
                { label: 'Reject', decision: r.actions.reject, onClick: () => setDialog('reject'), variant: 'danger', icon: <X size={15} /> },
                { label: 'Approve', decision: r.actions.approve, onClick: () => setDialog('approve'), variant: 'primary', icon: <Check size={15} /> },
              ]}
            />
          )
        }
        notice={decisionNotice || selfNotice || waitingNotice || null}
        aside={
          <Card title="Change history" actions={compact ? <Link className="link" to={`/refunds/${r.id}`}>Open full refund <ArrowRight size={14} /></Link> : undefined}>
            <ChangeHistory app="refunds" recordId={r.id} limit={compact ? 3 : undefined} />
          </Card>
        }
      >
        <Card title="Refund">
          <FieldList
            fields={[
              { label: 'Customer', value: r.customer },
              { label: 'Amount', value: <span className="mono">{amount(r.amountCents)}</span> },
              { label: 'Requested', value: formatDateTime(r.requestedAt) },
              { label: 'Requested by', value: <PersonInline person={r.requestedBy} /> },
              { label: 'Reason', value: r.reason, wide: true },
              ...(compact ? [] : [{ label: 'Summary', value: r.summary || '—', wide: true }]),
              ...(r.decidedBy ? [{ label: 'Decided by', value: <PersonInline person={r.decidedBy} /> }] : []),
              ...(r.autoApproved ? [{ label: 'Decided by', value: 'Automatic approval ($1,000 or less)' }] : []),
            ]}
          />
        </Card>
      </RecordPage>

      <ConfirmDialog
        open={dialog === 'approve'}
        title={`Approve ${r.id}?`}
        body={
          <>
            {what}
            <p>The refund of <strong>{amount(r.amountCents)}</strong> is released to the customer.</p>
          </>
        }
        confirmLabel={`Approve ${amount(r.amountCents)}`}
        note={{ label: 'Note', placeholder: 'Anything the team should know' }}
        onConfirm={act('approve', `${r.id} approved`)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title={`Reject ${r.id}?`}
        body={what}
        tone="danger"
        confirmLabel="Reject refund"
        note={{ label: 'Why are you rejecting it?', placeholder: 'The requester will see this in the change log', required: true }}
        onConfirm={act('reject', `${r.id} rejected`)}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
