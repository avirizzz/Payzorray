import { useEffect, useState } from 'react';
import { getCartInsight } from '../../api/agent';
import { RECEIPT } from './LightCard';
import { SparkleIcon } from '../ui/icons';

// Checks are computed server-side; only the closing paragraph is model-written.
const VERDICT = {
  pass: { color: '#1a8a5f', mark: '✓' },
  warn: { color: '#b07d00', mark: '!' },
  fail: { color: '#c73737', mark: '✕' },
  unknown: { color: RECEIPT.textMuted, mark: '–' }
};

export default function CartInsightPanel({ cart, customerId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const items = cart.items.map((it) => ({
      product_id: it.product.product_id,
      name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
      category: it.product.category,
      stock: it.product.stock
    }));

    setLoading(true);
    getCartInsight({ items, customerId })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [cart.items.map((it) => `${it.product.product_id}:${it.quantity}`).join(','), customerId]);

  if (loading) {
    return (
      <div style={{ padding: '11px 13px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, marginTop: '12px' }}>
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted }}>Looking over your cart…</p>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 13px 12px 17px',
        borderRadius: 'var(--radius)',
        background: 'rgba(13,148,251,0.08)',
        border: '1px solid rgba(13,148,251,0.22)',
        marginTop: '12px',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--gradient-accent)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <SparkleIcon size={12} style={{ color: 'var(--color-blue)' }} />
        <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: RECEIPT.textMuted }}>
          Before you pay
        </span>
      </div>

      {data.checks?.map((c) => {
        const v = VERDICT[c.verdict] || VERDICT.unknown;
        return (
          <div key={c.key} style={{ display: 'flex', gap: '7px', alignItems: 'baseline', marginBottom: '4px' }}>
            <span style={{ color: v.color, fontWeight: 800, fontSize: '0.72rem', flexShrink: 0, width: 10 }}>{v.mark}</span>
            <span style={{ fontSize: '0.72rem', color: RECEIPT.text, flexShrink: 0 }}>{c.label}</span>
            <span style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {c.detail}
            </span>
          </div>
        );
      })}

      {data.insight && (
        <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.text, lineHeight: 1.55, marginTop: '9px', fontStyle: 'italic' }}>
          {data.insight}
        </p>
      )}
    </div>
  );
}
