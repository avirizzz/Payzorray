import Card from '../ui/Card';
import Button from '../ui/Button';

const FREQUENCY_LABELS = {
  as_presented: 'Charged when a purchase is presented',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly'
};

export default function SimulatedBankApproval({ mandate, onApprove, onDecline, busy, title = 'Mandate Approval', confirmLabel = 'Approve', note }) {
  const validUntil = new Date(mandate.razorpay_token.expire_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card variant="loud" style={{ background: 'var(--color-surface)', maxWidth: '420px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', marginBottom: '14px' }}>{title}</p>

      <div style={{ border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Row label="Payee" value="AI Buyer Agent" />
        <Row label="Maximum amount" value={`₹${mandate.razorpay_token.original_max_amount}`} />
        <Row label="Frequency" value={FREQUENCY_LABELS[mandate.razorpay_token.frequency] || mandate.razorpay_token.frequency} />
        <Row label="Valid until" value={validUntil} />
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
        {note || 'Approving lets the AI agent charge purchases up to this cap without asking you again each time, until the cap runs out or this expires.'}
      </p>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="ghost" onClick={onDecline} disabled={busy} style={{ flex: 1 }}>
          Decline
        </Button>
        <Button variant="primary" onClick={onApprove} disabled={busy} style={{ flex: 1 }}>
          {busy ? 'Opening Razorpay…' : confirmLabel}
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
