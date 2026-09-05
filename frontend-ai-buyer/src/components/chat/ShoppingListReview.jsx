import { useState } from 'react';
import ProductImage from '../ui/ProductImage';
import { CheckIcon, InfoIcon } from '../ui/icons';
import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, SummaryRow, LightButton, RECEIPT } from './LightCard';

function scoreColor(n) {
  if (n == null) return RECEIPT.textMuted;
  if (n >= 80) return '#1a8a5f';
  if (n >= 55) return '#b07d00';
  return '#c73737';
}

export default function ShoppingListReview({ data, onConfirm, scores, onPreview }) {
  const [selections, setSelections] = useState(() => data.items.map((it) => it.options[0]?.product_id ?? null));
  const [confirmed, setConfirmed] = useState(false);

  const selectableCount = data.items.filter((it) => it.options.length > 0).length;
  const selectedTotal = data.items.reduce((sum, it, i) => {
    const chosen = it.options.find((o) => o.product_id === selections[i]);
    return sum + (chosen?.price || 0) * (it.quantity || 1);
  }, 0);

  function handleConfirm() {
    if (confirmed || selectableCount === 0) return;
    setConfirmed(true);
    const picks = data.items
      .map((it, i) => {
        const chosen = it.options.find((o) => o.product_id === selections[i]);
        return chosen ? { product: chosen, quantity: it.quantity || 1 } : null;
      })
      .filter(Boolean);
    onConfirm(picks);
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div
        aria-hidden="true"
        style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700 }}
      >
        AI
      </div>
      <LightCard title="Review Your List" badge={data.vendorId ? merchantName(data.vendorId) : null} maxWidth="420px">
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '12px' }}>Pick one match per line</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          {data.items.map((it, i) => (
            <div key={`${it.query}-${i}`}>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: RECEIPT.textMuted, marginBottom: '7px' }}>
                {it.quantity > 1 ? `${it.quantity}× ` : ''}"{it.query}"
              </p>
              {it.options.length === 0 ? (
                <p style={{ fontSize: 'var(--text-xs)', color: '#c73737' }}>No match found</p>
              ) : (
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {it.options.map((opt) => {
                    const active = selections[i] === opt.product_id;
                    return (
                      <button
                        key={opt.product_id}
                        type="button"
                        disabled={confirmed}
                        onClick={() => setSelections((prev) => prev.map((s, j) => (j === i ? opt.product_id : s)))}
                        className="press-on-active"
                        style={{
                          position: 'relative',
                          width: '104px',
                          flexShrink: 0,
                          padding: 0,
                          overflow: 'hidden',
                          borderRadius: 'var(--radius)',
                          textAlign: 'left',
                          border: active ? '1.5px solid var(--color-blue)' : `1.5px solid ${RECEIPT.panelBorder}`,
                          background: active ? 'rgba(13,148,251,0.06)' : '#ffffff',
                          cursor: confirmed ? 'default' : 'pointer'
                        }}
                      >
                        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: RECEIPT.thumbBg }}>
                          <ProductImage src={opt.image} alt={opt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {/* Preview must not also select the option. */}
                          {onPreview && !confirmed && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Preview ${opt.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreview(opt.product_id, (chosen) =>
                                  setSelections((prev) => prev.map((sel, j) => (j === i ? chosen : sel)))
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onPreview(opt.product_id, (chosen) =>
                                    setSelections((prev) => prev.map((sel, j) => (j === i ? chosen : sel)))
                                  );
                                }
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.94)',
                                border: `1px solid ${RECEIPT.panelBorder}`,
                                color: RECEIPT.text,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <InfoIcon size={11} />
                            </span>
                          )}
                          {active && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '4px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: 'var(--color-blue)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <CheckIcon size={9} />
                            </span>
                          )}
                          {scores?.[opt.product_id]?.overall != null && (
                            <span
                              title="How well this suits you"
                              style={{
                                position: 'absolute',
                                bottom: '4px',
                                left: '4px',
                                padding: '1px 5px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255,255,255,0.94)',
                                border: `1px solid ${scoreColor(scores[opt.product_id].overall)}`,
                                color: scoreColor(scores[opt.product_id].overall),
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              {scores[opt.product_id].overall}
                            </span>
                          )}
                        </div>
                        <div style={{ padding: '6px 7px 7px' }}>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, lineHeight: 1.25, color: RECEIPT.text, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{opt.name}</div>
                          <div className="gauge-number" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-blue)', marginTop: '2px' }}>
                            ₹{opt.price}
                            {it.quantity > 1 ? ` × ${it.quantity}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <SummaryRow label="Estimated total" value={`₹${selectedTotal}`} strong accent />

        <LightButton variant="primary" style={{ width: '100%', marginTop: '14px' }} disabled={confirmed || selectableCount === 0} onClick={handleConfirm}>
          {confirmed ? 'Added to cart' : `Add ${selectableCount} item${selectableCount === 1 ? '' : 's'} to cart`}
        </LightButton>
      </LightCard>
    </div>
  );
}
