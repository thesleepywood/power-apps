import { ROLES, type Role } from '../shared/roles';
import type { Decision } from '../shared/types';
import type { User } from '../shared/users';
import { ApiError } from './errors';

export const allow = (): Decision => ({ allowed: true });
export const deny = (code: string, reason: string): Decision => ({ allowed: false, code, reason });

/** Role gate with a human "why not" message, e.g. "Approvers only". */
export function requireRole(user: User, roles: Role[]): Decision {
  if (roles.includes(user.role)) return allow();
  if (user.role === 'observer') return deny('read_only', 'Observers have read-only access');
  const names = roles.filter((r) => r !== 'observer').map((r) => ROLES[r].plural);
  return deny('role', `${names.join(' and ')} only`);
}

/** May this person change anything at all? (Every role except Observer.) */
export function canChange(user: User): Decision {
  return requireRole(user, ['operator', 'approver']);
}

/** Returns the first denial, or allow. Pass checks as thunks so later ones can assume earlier ones passed. */
export function firstDenial(...checks: Array<() => Decision>): Decision {
  for (const check of checks) {
    const d = check();
    if (!d.allowed) return d;
  }
  return allow();
}

/** Throws a 403 carrying the reason if the decision is a denial. */
export function enforce(decision: Decision): void {
  if (!decision.allowed) throw new ApiError(403, decision.code, decision.reason);
}
