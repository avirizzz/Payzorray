import { useState } from 'react';
import { LightCard, SummaryRow, LightButton, RECEIPT } from './LightCard';

// Order past shipping becomes a refund, not a cancellation.
export default function CancelOrderCard({ proposal, onConfirm, onDismiss }) {
  const [state, setState] = useState('idle');
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);

  const isRefund = proposal.outcome === 'REFUNDED';

  async function handleConfirm() {
    if (state === 'working' || state === 'done') return;
    setState('working');
    setError(null);
    try {
      const result = await onConfirm(proposal.order_id);
      if (result?.status === 'CANCELLED' || result?.status === 'REFUNDED') {
        setOutcome(result.status);
        setState('done');
      } else {
        setError(result?.reason || "That couldn't be processed just now — nothing was changed.");
        setState('error');
      }
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div
        aria-hidden="true"
        style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700 }}
      >
        AI
      </div>

      <LightCard title={isRefund ? 'Refund This Order' : 'Cancel This Order'} badge={proposal.tracking_stage} maxWidth="420px">
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '4px' }}>{proposal.product_name}</p>
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginBottom: '13px' }}>{proposal.order_id}</p>

        <div style={{ background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: 'var(--radius)', padding: '12px 13px', marginBottom: '14px' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.text, lineHeight: 1.55 }}>{proposal.explanation}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
          <SummaryRow label="What happens" value={isRefund ? 'Refunded' : 'Cancelled'} />
          <SummaryRow label="Money goes back to" value={proposal.money_back_to} />
        </div>
        <SummaryRow label="Amount returned" value={`₹${proposal.amount}`} strong accent />

        {state === 'done' ? (
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#1a8a5f', marginTop: '14px', textAlign: 'center' }}>
            {outcome === 'REFUNDED' ? 'Refunded' : 'Cancelled'} — ₹{proposal.amount} is on its way back to {proposal.money_back_to}.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <LightButton variant="ghost" style={{ flex: 1 }} onClick={onDismiss} disabled={state === 'working'}>
              Keep it
            </LightButton>
            <LightButton
              variant="primary"
              style={{ flex: 1, background: '#c73737' }}
              onClick={handleConfirm}
              disabled={state === 'working'}
            >
              {state === 'working' ? 'Processing…' : isRefund ? 'Yes, refund it' : 'Yes, cancel it'}
            </LightButton>
          </div>
        )}

        {error && (
          <p style={{ fontSize: '0.72rem', color: '#c73737', marginTop: '9px' }}>{error}</p>
        )}
      </LightCard>
    </div>
  );
}
