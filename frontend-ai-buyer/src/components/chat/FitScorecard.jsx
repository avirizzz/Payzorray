import { RECEIPT } from './LightCard';

const VERDICT = {
  pass: { color: '#1a8a5f', mark: '✓' },
  warn: { color: '#b07d00', mark: '!' },
  fail: { color: '#c73737', mark: '✕' },
  unknown: { color: RECEIPT.textMuted, mark: '–' }
};

function bandColor(n) {
  if (n == null) return RECEIPT.textMuted;
  if (n >= 80) return '#1a8a5f';
  if (n >= 55) return '#b07d00';
  return '#c73737';
}

export default function FitScorecard({ fit, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}` }}>
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted }}>Checking how this suits you…</p>
      </div>
    );
  }
  if (!fit) return null;

  return (
    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: RECEIPT.textMuted }}>
          How this suits you
        </span>
        {fit.overall != null && (
          <span className="gauge-number" style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: bandColor(fit.overall) }}>
            {fit.overall}/100
          </span>
        )}
      </div>

      {fit.criteria.map((c) => {
        const v = VERDICT[c.verdict] || VERDICT.unknown;
        return (
          <div key={c.key} style={{ display: 'flex', gap: '7px', alignItems: 'baseline', marginBottom: '3px' }}>
            <span style={{ color: v.color, fontWeight: 800, flexShrink: 0, fontSize: '0.72rem', width: 10 }}>{v.mark}</span>
            <span style={{ fontSize: '0.72rem', color: RECEIPT.text, flexShrink: 0 }}>{c.label}</span>
            <span style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {c.detail}
            </span>
          </div>
        );
      })}

      {/* The one line that's judgement, not arithmetic. */}
      {fit.criteria.some((c) => !c.computed) && (
        <p style={{ fontSize: '0.66rem', color: RECEIPT.textMuted, marginTop: '6px', fontStyle: 'italic' }}>
          Everything except the preference line is measured, not judged.
        </p>
      )}
    </div>
  );
}
