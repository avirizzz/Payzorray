import { useEffect, useState } from 'react';
import { getProduct, findVariants } from '../../api/catalog';
import { getInsight } from '../../api/agent';
import ProductImage from '../ui/ProductImage';
import { SparkleIcon, CartIcon } from '../ui/icons';
import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, LightButton, RECEIPT } from './LightCard';
import FitScorecard from './FitScorecard';
import { trackEvent } from '../../api/events';

export default function ProductPreviewModal({ productId, customerId, cartVendor, onClose, onSelect, onAddToCart, onTrace, fit, fitLoading, onPickOption }) {
  const [viewingId, setViewingId] = useState(productId);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    setViewingId(productId);
  }, [productId]);

  useEffect(() => {
    if (!viewingId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProduct(null);
    setInsight(null);
    setVariants([]);
    getProduct(viewingId)
      .then(({ product: p }) => {
        if (cancelled) return;
        setProduct(p);
        trackEvent('PRODUCT_VIEWED', { productId: p.product_id, amount: p.price });
        setInsightLoading(true);
        onTrace?.(`Getting a read on "${p.name}"…`);
        getInsight({ customerId, productId: p.product_id })
          .then((text) => !cancelled && setInsight(text))
          .catch(() => !cancelled && setInsight(null))
          .finally(() => !cancelled && setInsightLoading(false));
        if (p.model) {
          onTrace?.(`Checking for other colors/trims of "${p.model}"…`);
          findVariants(p.model, p.product_id)
            .then((list) => !cancelled && setVariants(list))
            .catch(() => !cancelled && setVariants([]));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingId, customerId]);

  if (!productId) return null;

  const vendorMismatch = product && cartVendor && product.merchant_id !== cartVendor;

  // List line: only "choose this" is offered.
  const footer = product ? (
    onPickOption ? (
      <LightButton
        variant="primary"
        style={{ width: '100%' }}
        onClick={() => {
          onPickOption(product.product_id);
          onClose();
        }}
      >
        Choose this one
      </LightButton>
    ) : (
      <>
        <div style={{ display: 'flex', gap: '8px' }}>
          <LightButton
            variant="ghost"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: vendorMismatch ? 0.45 : 1 }}
            disabled={vendorMismatch}
            onClick={() => {
              onAddToCart(product);
              onClose();
            }}
          >
            <CartIcon size={13} />
            Add to cart
          </LightButton>
          <LightButton
            variant="primary"
            style={{ flex: 1 }}
            onClick={() => {
              onSelect(product);
              onClose();
            }}
          >
            Buy now
          </LightButton>
        </div>
        {vendorMismatch && (
          <p style={{ fontSize: '0.68rem', color: RECEIPT.textMuted, marginTop: '8px' }}>
            Your cart already has items from {merchantName(cartVendor)} — check out or clear it before adding from a different vendor.
          </p>
        )}
      </>
    )
  ) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,20,48,0.62)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 'var(--space-2)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '400px', maxHeight: '88vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}
      >
        <LightCard
          title={product?.name || 'Product'}
          badge={product?.merchant_id ? merchantName(product.merchant_id) : null}
          onClose={onClose}
          footer={footer}
          maxWidth="400px"
        >
          {loading && <p style={{ fontSize: 'var(--text-sm)', color: RECEIPT.textMuted }}>Loading…</p>}
          {error && <p style={{ color: '#c73737', fontSize: 'var(--text-sm)' }}>{error}</p>}

          {product && (
            <>
              <div
                style={{
                  aspectRatio: '4 / 3',
                  background: RECEIPT.thumbBg,
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${RECEIPT.panelBorder}`,
                  overflow: 'hidden',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ProductImage src={product.images?.[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, lineHeight: 1.35 }}>{product.name}</p>
                <p className="gauge-number" style={{ fontWeight: 800, fontSize: 'var(--text-lg)', color: 'var(--color-blue)', flexShrink: 0 }}>
                  ₹{product.price}
                </p>
              </div>

              {product.description && (
                <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted, lineHeight: 1.55, marginBottom: '14px' }}>{product.description}</p>
              )}

              {variants.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <p style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: RECEIPT.textMuted, marginBottom: '7px' }}>
                    Other colors / trims
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {variants.slice(0, 6).map((v) => (
                      <button
                        key={v.product_id}
                        type="button"
                        onClick={() => setViewingId(v.product_id)}
                        className="press-on-active"
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 11px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: RECEIPT.text,
                          background: '#fff',
                          border: `1.5px solid ${RECEIPT.panelBorder}`,
                          cursor: 'pointer'
                        }}
                      >
                        {v.variant || v.name} · ₹{v.price}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fit score only for the originally opened product, not variants. */}
              {(fit || fitLoading) && viewingId === productId && (
                <div style={{ marginBottom: '12px' }}>
                  <FitScorecard fit={fit} loading={fitLoading} />
                </div>
              )}

              <div
                style={{
                  position: 'relative',
                  padding: '11px 13px 11px 16px',
                  borderRadius: 'var(--radius)',
                  background: RECEIPT.panelBg,
                  border: `1px solid ${RECEIPT.panelBorder}`,
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--color-blue)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <SparkleIcon size={12} style={{ color: 'var(--color-blue)' }} />
                  <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: RECEIPT.textMuted }}>
                    AI Insight
                  </span>
                </div>
                {insightLoading ? (
                  <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted }}>Thinking…</p>
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', lineHeight: 1.55, color: RECEIPT.text, fontStyle: 'italic' }}>
                    {insight || "Couldn't put together a read on this one."}
                  </p>
                )}
              </div>
            </>
          )}
        </LightCard>
      </div>
    </div>
  );
}
