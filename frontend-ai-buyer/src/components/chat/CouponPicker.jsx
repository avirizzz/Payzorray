import { useEffect, useState } from 'react';
import { listCoupons, validateCoupon, listCouponsForCart, validateCouponForCart } from '../../api/commerce';
import { LightButton, RECEIPT } from './LightCard';

// Backend decides eligibility and discounts; this only displays results.
// Pass either `productId` (single-item mode) or `cart={merchantId, items}` (cart-wide mode).
export default function CouponPicker({ productId, cart, subtotal, applied, onApply, onClear, fieldInput }) {
  const [available, setAvailable] = useState([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const cartKey = cart ? `${cart.merchantId}:${cart.items.map((it) => it.product_id).join(',')}` : null;

  useEffect(() => {
    let cancelled = false;
    const fetchList = cart ? listCouponsForCart(cart.merchantId, cart.items) : listCoupons(productId);
    fetchList.then((list) => !cancelled && setAvailable(list || [])).catch(() => !cancelled && setAvailable([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, cartKey]);

  async function apply(couponCode) {
    if (!couponCode) return;
    setBusy(true);
    setError(null);
    try {
      const normalized = couponCode.trim().toUpperCase();
      const result = cart ? await validateCouponForCart(normalized, cart.merchantId, cart.items) : await validateCoupon(normalized, subtotal, productId);
      if (result.valid) {
        onApply(result);
        setCode('');
      } else {
        setError(result.reason || "That code didn't apply.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--radius)', background: 'rgba(26,138,95,0.08)', border: '1px solid rgba(26,138,95,0.3)' }}>
        <div style={{ minWidth: 0 }}>
          <p className="gauge-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#1a8a5f' }}>{applied.code}</p>
          <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginTop: '2px' }}>{applied.description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <span className="gauge-number" style={{ fontWeight: 700, color: '#1a8a5f' }}>-₹{applied.discount}</span>
          <button
            type="button"
            onClick={onClear}
            className="press-on-active"
            style={{ background: 'none', border: 'none', color: RECEIPT.textMuted, fontSize: '0.72rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {available.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {available.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => apply(c.code)}
              disabled={busy}
              className="press-on-active"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                background: '#ffffff',
                border: `1px dashed ${RECEIPT.panelBorder}`,
                cursor: 'pointer'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p className="gauge-number" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text }}>{c.code}</p>
                <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.description}
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-blue)', flexShrink: 0 }}>Apply</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={available.length ? 'Or enter another code' : 'Enter code (optional)'}
          style={fieldInput}
        />
        <LightButton variant="ghost" onClick={() => apply(code)} disabled={busy || !code.trim()}>
          {busy ? '…' : 'Apply'}
        </LightButton>
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600, marginTop: '8px' }}>{error}</p>}
    </div>
  );
}
