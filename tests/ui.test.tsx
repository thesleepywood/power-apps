// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionBar, PermissionButton, StatusBadge } from '../src/foundation/client/ui';
import { diffSnapshots } from '../src/foundation/shared/diff';

describe('UI explains why an action is not allowed', () => {
  it('ActionBar locks denied actions and lists each reason once', () => {
    const onApprove = vi.fn();
    render(
      <ActionBar
        actions={[
          { label: 'Reject', decision: { allowed: false, code: 'role', reason: 'Approvers only' }, onClick: vi.fn() },
          { label: 'Approve', decision: { allowed: false, code: 'role', reason: 'Approvers only' }, onClick: onApprove },
          { label: 'Withdraw', decision: { allowed: false, code: 'x', reason: 'Hidden' }, onClick: vi.fn(), hideWhenDenied: true },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getAllByText('Approvers only')).toHaveLength(1);
    expect(screen.queryByText('Withdraw')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('PermissionButton shows the server reason when denied', () => {
    render(<PermissionButton decision={{ allowed: false, code: 'read_only', reason: 'Observers have read-only access' }} onClick={vi.fn()}>New request</PermissionButton>);
    expect(screen.getByRole('button', { name: 'New request' })).toBeDisabled();
    expect(screen.getByText('Observers have read-only access')).toBeInTheDocument();
  });

  it('StatusBadge labels known statuses', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('diffSnapshots', () => {
  it('lists changed fields only', () => {
    expect(diffSnapshots({ status: 'pending', n: 1 }, { status: 'approved', n: 1 })).toEqual([{ field: 'status', before: 'pending', after: 'approved' }]);
  });
});
