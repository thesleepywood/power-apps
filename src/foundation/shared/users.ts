import type { Role } from './roles';

export interface User {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  role: Role;
  title: string;
}

function person(id: string, name: string, role: Role, title: string): User {
  const parts = name.split(' ');
  return {
    id,
    name,
    firstName: parts[0],
    initials: parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    role,
    title,
  };
}

/** Fictional example people. There is no real sign-in in this prototype. */
export const USERS: User[] = [
  person('u-maya', 'Maya Chen', 'operator', 'Payments Operations Analyst'),
  person('u-diego', 'Diego Alvarez', 'operator', 'Customer Operations Specialist'),
  person('u-priya', 'Priya Natarajan', 'approver', 'Compliance Lead'),
  person('u-samuel', 'Samuel Okafor', 'approver', 'Head of Payments Operations'),
  person('u-grace', 'Grace Liu', 'observer', 'Internal Audit'),
];

export function findUser(id: string | undefined | null): User | undefined {
  return id ? USERS.find((u) => u.id === id) : undefined;
}
