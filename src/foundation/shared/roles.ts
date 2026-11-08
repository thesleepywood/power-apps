export type Role = 'operator' | 'approver' | 'observer';

export interface RoleInfo {
  id: Role;
  label: string;
  plural: string;
  /** One-line description of the role's job. */
  summary: string;
  can: string[];
  cannot: string[];
}

/**
 * The three roles shared by every app. This module is descriptive only —
 * what a role is actually allowed to do is decided on the server.
 */
export const ROLES: Record<Role, RoleInfo> = {
  operator: {
    id: 'operator',
    label: 'Operator',
    plural: 'Operators',
    summary: 'Does the daily work and keeps records moving.',
    can: ['Work standard, low-risk cases', 'Send high-risk items on to an Approver'],
    cannot: ['Give final sign-off on anything that needs an Approver'],
  },
  approver: {
    id: 'approver',
    label: 'Approver',
    plural: 'Approvers',
    summary: 'Handles anything that needs sign-off.',
    can: ['Everything an Operator can do', 'Approve or reject anything that needs sign-off'],
    cannot: ['Approve or reject a record you opened yourself'],
  },
  observer: {
    id: 'observer',
    label: 'Observer',
    plural: 'Observers',
    summary: 'Can read everything but change nothing.',
    can: ['View every app, record and change-log entry'],
    cannot: ['Create, edit, approve or reject anything'],
  },
};

export const ROLE_ORDER: Role[] = ['operator', 'approver', 'observer'];
