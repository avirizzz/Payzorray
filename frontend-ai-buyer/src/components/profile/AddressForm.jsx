import { useState } from 'react';
import Button from '../ui/Button';
import { CloseIcon } from '../ui/icons';

const EMPTY = { label: '', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'India' };

const fieldInput = {
  border: '1px solid var(--glass-border-strong)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  background: 'rgba(0,0,0,0.2)',
  color: '#ffffff',
  fontSize: 'var(--text-sm)',
  width: '100%',
  boxSizing: 'border-box'
};

// Nickname is required: chat picks addresses by it.
export default function AddressForm({ initialValue, onSubmit, onCancel, busy }) {
  const [form, setForm] = useState(initialValue || EMPTY);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(1,38,82,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-2)' }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-strong"
        style={{ width: '100%', maxWidth: '380px', borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', padding: 'var(--space-3)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)' }}>{initialValue ? 'Edit address' : 'Add an address'}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="press-on-active"
            style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '50%', color: 'var(--color-text-muted)' }}
          >
            <CloseIcon size={13} />
          </button>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '14px' }}>Give it a short nickname -- you'll type this in chat to pick it at checkout.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <input placeholder="Nickname (e.g. Home, Office)" value={form.label} onChange={set('label')} style={fieldInput} required />
          <input placeholder="Address line 1" value={form.line1} onChange={set('line1')} style={fieldInput} required />
          <input placeholder="Address line 2 (optional)" value={form.line2} onChange={set('line2')} style={fieldInput} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input placeholder="City" value={form.city} onChange={set('city')} style={fieldInput} required />
            <input placeholder="State" value={form.state} onChange={set('state')} style={fieldInput} required />
          </div>
          <input placeholder="Postal code" value={form.postal_code} onChange={set('postal_code')} style={fieldInput} required />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Saving…' : 'Save address'}
          </Button>
        </div>
      </form>
    </div>
  );
}
