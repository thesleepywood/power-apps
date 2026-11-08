import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { REQUEST_KINDS, type NewSignOffRequest, type SignOffRequestView } from '../types';
import { api } from '../../foundation/client/api';
import { Button } from '../../foundation/client/ui';

const EMPTY: NewSignOffRequest = { kind: 'Limit increase', title: '', customerName: '', customerSsn: '', amount: null, reason: '', summary: '' };

export function NewRequestDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: SignOffRequestView) => void }) {
  const [form, setForm] = useState<NewSignOffRequest>(EMPTY);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setAmount('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;
  const set = <K extends keyof NewSignOffRequest>(k: K, v: NewSignOffRequest[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<SignOffRequestView>('/apps/approvals/requests', { method: 'POST', body: { ...form, amount: amount === '' ? null : amount } });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="new-title" onSubmit={submit}>
        <header className="dialog-header">
          <h2 id="new-title">New sign-off request</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body form-grid">
          <label className="field">
            <span className="field-label">Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as NewSignOffRequest['kind'])}>
              {REQUEST_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">
              Amount <span className="field-optional">(optional)</span>
            </span>
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field is-wide">
            <span className="field-label">Title</span>
            <input value={form.title} placeholder="e.g. Raise daily ACH limit to $25,000" onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Customer name</span>
            <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Customer SSN</span>
            <input value={form.customerSsn} placeholder="9XX-XX-XXXX" autoComplete="off" onChange={(e) => set('customerSsn', e.target.value)} />
            <span className="field-hint">Stored on the server only. Everyone, including you, will see it masked.</span>
          </label>
          <label className="field is-wide">
            <span className="field-label">Reason</span>
            <input value={form.reason} placeholder="One line the Approver sees first" onChange={(e) => set('reason', e.target.value)} />
          </label>
          <label className="field is-wide">
            <span className="field-label">
              Summary <span className="field-optional">(optional)</span>
            </span>
            <textarea rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
          </label>
          {error && (
            <div className="inline-error is-wide" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Opening…' : 'Open request'}
          </Button>
        </footer>
      </form>
    </div>
  );
}
