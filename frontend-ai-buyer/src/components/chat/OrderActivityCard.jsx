import { LightCard, RECEIPT } from './LightCard';
import { LockIcon } from '../ui/icons';

// Append-only audit entries written by code, not reconstructed or model-written.
const DECISION = {
  Allowed: { color: '#1a8a5f', dot: '#1a8a5f' },
  Denied: { color: '#c73737', dot: '#c73737' },
  'Needed approval': { color: '#b07d00', dot: '#b07d00' }
};

function when(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function OrderActivityCard({ activity }) {
  const steps = activity?.steps || [];

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div
        aria-hidden="true"
        style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700 }}
      >
        AI
      </div>

      <LightCard title="What Happened" badge={activity.order_status} maxWidth="440px">
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginBottom: '14px' }}>
          {activity.order_id} · {activity.step_count} recorded step{activity.step_count === 1 ? '' : 's'}
        </p>

        {steps.length === 0 ? (
          <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>
            No steps are recorded against this order.
          </p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '18px' }}>
            <div style={{ position: 'absolute', left: '4px', top: '6px', bottom: '6px', width: '1px', background: RECEIPT.divider }} />

            {steps.map((s, i) => {
              const d = DECISION[s.decision] || { color: RECEIPT.textMuted, dot: RECEIPT.textMuted };
              return (
                <div key={`${s.at}-${i}`} style={{ position: 'relative', paddingBottom: i === steps.length - 1 ? 0 : '14px' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '-18px',
                      top: '4px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: d.dot,
                      border: '2px solid #fff',
                      boxShadow: `0 0 0 1px ${d.dot}`
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: RECEIPT.text }}>{s.what}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: d.color, flexShrink: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {s.decision}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.66rem', color: RECEIPT.textMuted }}>{when(s.at)}</span>
                    {s.amount != null && (
                      <span className="gauge-number" style={{ fontSize: '0.7rem', fontWeight: 700, color: RECEIPT.text, flexShrink: 0 }}>
                        ₹{s.amount}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: RECEIPT.text, lineHeight: 1.5, marginTop: '4px' }}>{s.why}</p>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '15px', paddingTop: '11px', borderTop: `1px solid ${RECEIPT.divider}` }}>
          <LockIcon size={11} style={{ color: RECEIPT.textMuted, flexShrink: 0 }} />
          <span style={{ fontSize: '0.66rem', color: RECEIPT.textMuted, lineHeight: 1.4 }}>
            Read from an append-only record written at the time of each decision. It cannot be edited after the fact.
          </span>
        </div>
      </LightCard>
    </div>
  );
}
