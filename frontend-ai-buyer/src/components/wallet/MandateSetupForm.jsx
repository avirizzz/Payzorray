import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

// No real NPCI consent step exists; this form simulates it.
export default function MandateSetupForm({ onSubmit, busy }) {
  const [amount, setAmount] = useState('5000');
  const [expiry, setExpiry] = useState(defaultExpiry());
  const [frequency, setFrequency] = useState('as_presented');

  function handleSubmit(e) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) return;
    const expireAt = new Date(`${expiry}T23:59:59`).getTime();
    onSubmit({ amount: parsedAmount, expireAt, frequency });
  }

  return (
    <Card variant="loud" style={{ maxWidth: '420px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', marginBottom: '10px' }}>Set up your AI Buyer Wallet</p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
        Set a spending cap once -- the agent holds a scoped, revocable token against it and confirms with you before every purchase, without asking you to pay again each time.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={fieldLabel}>
          Maximum amount (₹)
          <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} style={fieldInput} required />
        </label>

        <label style={fieldLabel}>
          Valid until
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} style={fieldInput} required />
        </label>

        <label style={fieldLabel}>
          Frequency
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={fieldInput}>
            <option value="as_presented">Charged when a purchase is presented (recommended)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%', marginTop: '4px' }}>
          {busy ? 'Requesting…' : 'Continue to Approval'}
        </Button>
      </form>
    </Card>
  );
}

const fieldLabel = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)' };
const fieldInput = {
  border: '1px solid var(--glass-border-strong)',
  borderRadius: 'var(--radius)',
  padding: '10px 12px',
  fontFamily: 'var(--font-body)',
  background: 'rgba(0,0,0,0.2)',
  color: '#ffffff',
  fontSize: 'var(--text-sm)'
};
