import type { User } from '../shared/users';

export const MASK = '•';

/**
 * SSN-style masking. `last4` keeps the final four digits ("•••-••-6789"),
 * `full` hides everything ("•••-••-••••"). Never returns any other digits.
 */
export function maskSsn(ssn: string, mode: 'last4' | 'full' = 'last4'): string {
  const digits = (ssn ?? '').replace(/\D/g, '');
  const last4 = mode === 'last4' && digits.length >= 4 ? digits.slice(-4) : MASK.repeat(4);
  return `${MASK.repeat(3)}-${MASK.repeat(2)}-${last4}`;
}

/** Generic tail masking for account numbers and the like. */
export function maskTail(value: string, visible = 4): string {
  const v = value ?? '';
  if (v.length <= visible) return MASK.repeat(v.length);
  return MASK.repeat(v.length - visible) + v.slice(-visible);
}

/**
 * Who sees how much of an SSN. Operators and Approvers see the last four
 * digits to match a caller; Observers see nothing. Nobody receives the full value.
 */
export function ssnForViewer(ssn: string, viewer: User): string {
  return maskSsn(ssn, viewer.role === 'observer' ? 'full' : 'last4');
}
