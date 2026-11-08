import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './primitives';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** Show a note field. `required` makes the confirm button wait for text. */
  note?: { label: string; placeholder?: string; required?: boolean };
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}

/** Every change goes through one of these. Server errors are shown inside the dialog. */
export function ConfirmDialog({ open, title, body, confirmLabel, tone = 'primary', note, onConfirm, onClose }: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setError(null);
    setBusy(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLElement>('textarea, button.btn-primary, button.btn-danger')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const blocked = busy || (note?.required && !text.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={dialogRef}>
        <header className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="dialog-body">
          {body}
          {note && (
            <label className="field">
              <span className="field-label">
                {note.label}
                {!note.required && <span className="field-optional"> (optional)</span>}
              </span>
              <textarea rows={3} value={text} placeholder={note.placeholder} onChange={(e) => setText(e.target.value)} />
            </label>
          )}
          {error && (
            <div className="inline-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <footer className="dialog-footer">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} disabled={!!blocked}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}
