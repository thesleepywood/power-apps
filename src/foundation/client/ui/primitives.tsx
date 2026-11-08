import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ROLES, type Role } from '../../shared/roles';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

export function Badge({ tone = 'neutral', children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Avatar({ initials, role, size = 'md' }: { initials: string; role: Role; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar avatar-${size} avatar-${role}`} aria-hidden>
      {initials}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`role-badge role-${role}`}>{ROLES[role].label}</span>;
}

export function Card({ title, actions, children, className = '', padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={o.value === value} className={`tab ${o.value === value ? 'is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="tab-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
