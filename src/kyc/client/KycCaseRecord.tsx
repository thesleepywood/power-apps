import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
import type { KycCaseView } from '../types';
import { api } from '../../foundation/client/api';
import { formatDateTime, timeAgo } from '../../foundation/client/format';
import { useApi, useSession } from '../../foundation/client/session';
import { ActionBar, Avatar, Card, ChangeHistory, ConfirmDialog, ErrorState, FieldList, LoadingState, RecordPage, RoleBadge, StatusBadge, useToast } from '../../foundation/client/ui';
import { ROLES } from '../../foundation/shared/roles';

type Person = KycCaseView['openedBy'];

function PersonInline({ person }: { person: Person }) {
  return (
    <span className="person-inline">
      <Avatar initials={person.name.split(' ').map((p) => p[0]).join('')} role={person.role} size="sm" />
      {person.name}
      <RoleBadge role={person.role} />
    </span>
  );
}

export function KycCaseRecord({ id, compact = false }: { id: string; compact?: boolean }) {
  const { data: c, error, loading, reload } = useApi<KycCaseView>(`/apps/kyc/cases/${encodeURIComponent(id)}`);
  const { user, invalidate } = useSession();
  const toast = useToast();
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);

  if (loading && !c) return <Card><LoadingState rows={6} /></Card>;
  if (error || !c) {
    return (
      <Card>
        <ErrorState
          status={error?.status}
          title={error?.status === 404 ? `Case ${id} doesn't exist` : undefined}
          message={error?.status === 404 ? <>It may have been mistyped. <Link to="/kyc">Back to the KYC Review Queue</Link></> : error?.message}
          onRetry={error?.status === 404 ? undefined : reload}
        />
      </Card>
    );
  }

  const act = (path: string, message: string) => async (note: string) => {
    await api(`/apps/kyc/cases/${encodeURIComponent(c.id)}/${path}`, { method: 'POST', body: { note } });
    invalidate();
    toast(message);
  };

  const open = c.status === 'pending' || c.status === 'waiting';
  const isMine = c.openedBy.id === user?.id;

  const decisionNotice = !open && (
    <div className={`notice notice-${c.status}`}>
      <StatusBadge status={c.status} />
      <span>
        {c.status === 'approved' ? 'Approved' : 'Rejected'} by <strong>{c.decidedBy?.name}</strong>
        {c.decidedAt && <> · {formatDateTime(c.decidedAt)}</>}
        {c.decisionNote && <> — “{c.decisionNote}”</>}
      </span>
    </div>
  );

  const waitingNotice = c.status === 'waiting' && (
    <div className="notice notice-info">
      <StatusBadge status="waiting" />
      <span>
        Approved by <strong>{c.escalatedBy?.name}</strong>
        {c.escalatedAt && <> · {formatDateTime(c.escalatedAt)}</>}
        {c.escalationNote && <> — “{c.escalationNote}”</>}
        <span className="muted"> · Needs an Approver's final sign-off</span>
      </span>
    </div>
  );

  const escalateNotice = c.risk === 'high' && c.status === 'pending' && (
    <div className="notice notice-info">
      <RiskBadge risk="high" />
      {c.approveEscalates ? (
        <span>Approving sends this case to <strong>Waiting for approver</strong>. Only an Approver can give final sign-off.</span>
      ) : (
        <span>High-risk case: an Approver's approval is the final sign-off.</span>
      )}
    </div>
  );

  const selfNotice = open && isMine && user?.role !== 'observer' && (
    <div className="notice notice-info">You opened this case, so someone else has to decide it.</div>
  );

  const what = (
    <p>
      <strong>{c.customerName}</strong> ({c.id}) — {c.reviewReason}. This is recorded in the change log under your name.
    </p>
  );

  return (
    <>
      <RecordPage
        compact={compact}
        breadcrumb={compact ? undefined : { label: 'KYC Review Queue', to: '/kyc' }}
        id={c.id}
        title={c.customerName}
        status={
          <>
            <StatusBadge status={c.status} />
            <RiskBadge risk={c.risk} />
          </>
        }
        meta={
          <span>
            Opened by {c.openedBy.name} ({ROLES[c.openedBy.role].label}) {timeAgo(c.openedAt)}
          </span>
        }
        actions={
          open && (
            <ActionBar
              actions={[
                { label: 'Reject', decision: c.actions.reject, onClick: () => setDialog('reject'), variant: 'danger', icon: <X size={15} /> },
                { label: 'Approve', decision: c.actions.approve, onClick: () => setDialog('approve'), variant: 'primary', icon: <Check size={15} /> },
              ]}
            />
          )
        }
        notice={decisionNotice || waitingNotice || selfNotice || escalateNotice || null}
        aside={
          <Card title="Change history" actions={compact ? <Link className="link" to={`/kyc/${c.id}`}>Open full case <ArrowRight size={14} /></Link> : undefined}>
            <ChangeHistory app="kyc" recordId={c.id} limit={compact ? 3 : undefined} />
          </Card>
        }
      >
        <Card title="Case">
          <FieldList
            fields={[
              { label: 'Customer', value: c.customerName },
              { label: 'SSN', value: c.ssn, sensitive: true },
              { label: 'Risk level', value: <RiskBadge risk={c.risk} /> },
              { label: 'Opened', value: formatDateTime(c.openedAt) },
              { label: 'Opened by', value: <PersonInline person={c.openedBy} /> },
              { label: 'Review reason', value: c.reviewReason, wide: true },
              ...(compact ? [] : [{ label: 'Summary', value: c.summary || '—', wide: true }]),
              ...(c.escalatedBy ? [{ label: 'Sent to an Approver by', value: <PersonInline person={c.escalatedBy} /> }] : []),
              ...(c.decidedBy ? [{ label: 'Decided by', value: <PersonInline person={c.decidedBy} /> }] : []),
            ]}
          />
        </Card>
      </RecordPage>

      <ConfirmDialog
        open={dialog === 'approve'}
        title={c.approveEscalates ? `Approve ${c.id} and send to an Approver?` : `Approve ${c.id}?`}
        body={
          <>
            {what}
            {c.approveEscalates && <p>This is a high-risk case, so it moves to <strong>Waiting for approver</strong> until an Approver signs off.</p>}
          </>
        }
        confirmLabel={c.approveEscalates ? 'Approve and send' : 'Approve case'}
        note={{ label: 'Note', placeholder: 'Anything the team should know' }}
        onConfirm={act('approve', c.approveEscalates ? `${c.id} sent to an Approver` : `${c.id} approved`)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title={`Reject ${c.id}?`}
        body={what}
        tone="danger"
        confirmLabel="Reject case"
        note={{ label: 'Why are you rejecting it?', placeholder: 'The team will see this in the change log', required: true }}
        onConfirm={act('reject', `${c.id} rejected`)}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
