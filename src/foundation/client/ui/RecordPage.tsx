import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LockKeyhole } from 'lucide-react';

export interface Field {
  label: string;
  value: ReactNode;
  /** Value is masked by the server. */
  sensitive?: boolean;
  wide?: boolean;
}

export function SensitiveValue({ value }: { value: string }) {
  return (
    <span className="sensitive" title="Masked by the server. The full value never leaves the server.">
      <LockKeyhole size={13} />
      <span className="mono">{value}</span>
    </span>
  );
}

export function FieldList({ fields }: { fields: Field[] }) {
  return (
    <dl className="field-list">
      {fields.map((f) => (
        <div key={f.label} className={`field-item ${f.wide ? 'is-wide' : ''}`}>
          <dt>
            {f.label}
            {f.sensitive && <span className="sensitive-tag">Masked</span>}
          </dt>
          <dd>{f.sensitive && typeof f.value === 'string' ? <SensitiveValue value={f.value} /> : f.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Standard record page: breadcrumb, title with status, primary actions,
 * a main column of details and a side column (usually the change history).
 */
export function RecordPage({
  breadcrumb,
  id,
  title,
  status,
  meta,
  actions,
  notice,
  children,
  aside,
  compact = false,
}: {
  breadcrumb?: { label: string; to: string };
  id: string;
  title: ReactNode;
  status?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
}) {
  return (
    <article className={`record ${compact ? 'is-compact' : ''}`}>
      {breadcrumb && (
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
          <ChevronRight size={14} />
          <span className="mono">{id}</span>
        </nav>
      )}
      <header className="record-header">
        <div className="record-heading">
          <div className="record-id-row">
            <span className="record-id mono">{id}</span>
            {status}
          </div>
          <h1 className="record-title">{title}</h1>
          {meta && <div className="record-meta">{meta}</div>}
        </div>
        {actions && <div className="record-actions">{actions}</div>}
      </header>
      {notice}
      <div className="record-grid">
        <div className="record-main">{children}</div>
        {aside && <aside className="record-aside">{aside}</aside>}
      </div>
    </article>
  );
}
