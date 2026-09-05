import { useState } from 'react';
import ProductImage from '../ui/ProductImage';
import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, RECEIPT, LightButton } from './LightCard';
import { CheckIcon } from '../ui/icons';

function scoreColor(n) {
  if (n == null) return RECEIPT.textMuted;
  if (n >= 80) return '#1a8a5f';
  if (n >= 55) return '#b07d00';
  return '#c73737';
}

const MAX_COMPARE = 4;

export default function ProductOptionStack({ products, onPreview, onCompare, disabled, scores }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(false);

  if (!products?.length) return null;

  const vendors = new Set(products.map((p) => p.merchant_id).filter(Boolean));
  const vendorId = vendors.size === 1 ? [...vendors][0] : null;
  const canCompare = !!onCompare && products.length > 1;

  function toggleSelected(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function handleCompare() {
    if (selected.length < 2 || comparing) return;
    setComparing(true);
    try {
      await onCompare(selected);
      setSelected([]);
    } finally {
      setComparing(false);
    }
  }

  return (
    <div style={{ paddingLeft: '40px' }}>
      <LightCard title="Choose a Product" badge={vendorId ? merchantName(vendorId) : null} maxWidth="420px">
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '4px' }}>
          {products.length} match{products.length === 1 ? '' : 'es'} found
        </p>
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginBottom: '13px' }}>
          Tap one to see the full details before you buy{canCompare ? ', or check a few to compare them' : ''}.
        </p>

        {canCompare && selected.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginBottom: '10px',
              padding: '8px 10px',
              borderRadius: 'var(--radius)',
              background: 'rgba(13,148,251,0.08)',
              border: '1px solid rgba(13,148,251,0.25)'
            }}
          >
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-blue)' }}>
              {selected.length} selected{selected.length < 2 ? ' — pick one more' : ''}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <LightButton variant="ghost" style={{ padding: '5px 10px', fontSize: '0.68rem' }} onClick={() => setSelected([])} disabled={comparing}>
                Clear
              </LightButton>
              <LightButton
                variant="primary"
                style={{ padding: '5px 10px', fontSize: '0.68rem' }}
                onClick={handleCompare}
                disabled={selected.length < 2 || comparing}
              >
                {comparing ? 'Comparing…' : `Compare ${selected.length}`}
              </LightButton>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: '10px' }}>
          {products.map((p) => {
            const isHovered = hovered === p.product_id;
            const score = scores?.[p.product_id]?.overall;
            const isSelected = selected.includes(p.product_id);
            return (
              <button
                key={p.product_id}
                type="button"
                onClick={() => onPreview(p.product_id)}
                onMouseEnter={() => setHovered(p.product_id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(p.product_id)}
                onBlur={() => setHovered(null)}
                disabled={disabled}
                className="press-on-active"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  borderRadius: 'var(--radius)',
                  textAlign: 'left',
                  background: isHovered ? 'rgba(13,148,251,0.05)' : '#ffffff',
                  border: `1.5px solid ${isSelected ? 'var(--color-blue)' : isHovered ? 'var(--color-blue)' : RECEIPT.panelBorder}`,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1,
                  transition: 'border-color var(--transition-fast), background var(--transition-fast)'
                }}
              >
                <div style={{ position: 'relative', aspectRatio: '1 / 1', background: RECEIPT.thumbBg }}>
                  <ProductImage src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {canCompare && (
                    <span
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`Select ${p.name} to compare`}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelected(p.product_id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleSelected(p.product_id);
                        }
                      }}
                      className="press-on-active"
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--color-blue)' : 'rgba(255,255,255,0.9)',
                        border: `1.5px solid ${isSelected ? 'var(--color-blue)' : RECEIPT.panelBorder}`,
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected && <CheckIcon size={11} style={{ color: '#fff' }} />}
                    </span>
                  )}
                  {score != null && (
                    <span
                      title="How well this suits you — open for the breakdown"
                      style={{
                        position: 'absolute',
                        bottom: '5px',
                        left: '5px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255,255,255,0.94)',
                        border: `1px solid ${scoreColor(score)}`,
                        color: scoreColor(score),
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {score}
                    </span>
                  )}
                </div>

                <div style={{ padding: '7px 8px 0', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: RECEIPT.text,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {p.name}
                  </div>
                  <div className="gauge-number" style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-blue)', marginTop: '3px' }}>
                    ₹{p.price}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '7px',
                    padding: '6px 8px',
                    borderTop: `1px solid ${RECEIPT.divider}`,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: 'var(--color-blue)'
                  }}
                >
                  View details
                </div>
              </button>
            );
          })}
        </div>
      </LightCard>
    </div>
  );
}
