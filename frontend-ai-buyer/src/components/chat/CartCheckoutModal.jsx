import { useEffect, useState } from 'react';
import { getShippingOptions } from '../../api/commerce';
import CouponPicker from './CouponPicker';
import { CheckIcon, MapPinIcon } from '../ui/icons';
import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, MetaField, Panel, ItemRow, SummaryRow, LightButton, RECEIPT } from './LightCard';

const fieldInput = {
  border: `1px solid ${RECEIPT.panelBorder}`,
  borderRadius: 'var(--radius)',
  padding: '9px 12px',
  fontFamily: 'var(--font-body)',
  background: '#ffffff',
  color: RECEIPT.text,
  fontSize: 'var(--text-sm)',
  flex: 1,
  minWidth: 0
};

export default function CartCheckoutModal({ cart, address, customerId, onConfirm, onCancel, onTrace }) {
  const [shippingBySpeed, setShippingBySpeed] = useState(null);
  const [speed, setSpeed] = useState('standard');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [coupon, setCoupon] = useState(null);

  useEffect(() => {
    let cancelled = false;
    onTrace?.(`Checking delivery options for ${cart.items.length} items to ${address.label}…`);
    Promise.all(cart.items.map((it) => getShippingOptions({ productId: it.product.product_id, addressId: address.id, customerId })))
      .then((perItemOptions) => {
        if (cancelled) return;
        const bySpeed = { standard: [], express: [] };
        perItemOptions.forEach((options, i) => {
          const standard = options.find((o) => o.id === 'standard') || options[0];
          const express = options.find((o) => o.id === 'express') || options[options.length - 1];
          if (standard) bySpeed.standard.push({ itemIndex: i, ...standard });
          if (express) bySpeed.express.push({ itemIndex: i, ...express });
        });
        setShippingBySpeed(bySpeed);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, address.id, customerId]);

  const itemsSubtotal = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const shippingForSpeed = shippingBySpeed?.[speed] || [];
  const shippingTotal = shippingForSpeed.reduce((sum, s) => sum + s.cost, 0);
  const grandTotal = Math.max(0, itemsSubtotal + shippingTotal - (coupon?.discount || 0));
  const maxEta = shippingForSpeed.reduce((max, s) => Math.max(max, s.etaDays?.[1] || 0), 0);
  const minEta = shippingForSpeed.length ? Math.min(...shippingForSpeed.map((s) => s.etaDays?.[0] || 0)) : 0;
  const couponCartItems = cart.items.map((it) => ({ product_id: it.product.product_id, category: it.product.category, subtotal: it.product.price * it.quantity }));

  function handleConfirm() {
    if (loading || confirming) return;
    setConfirming(true);
    onConfirm({ shipping: { id: speed, label: speed === 'standard' ? 'Standard' : 'Express' }, coupon, total: grandTotal });
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(1,38,82,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-2)' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}>
        <LightCard
          title="Cart Checkout"
          badge={`${cart.items.length} item${cart.items.length > 1 ? 's' : ''}`}
          onClose={onCancel}
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <LightButton variant="ghost" onClick={onCancel} disabled={confirming} style={{ flex: 1 }}>
                Cancel
              </LightButton>
              <LightButton variant="primary" onClick={handleConfirm} disabled={loading || confirming} style={{ flex: 1 }}>
                {confirming ? 'Continuing…' : 'Continue to payment'}
              </LightButton>
            </div>
          }
        >
          <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', margin: '0 0 18px' }}>
            <MetaField label="Vendor" value={merchantName(cart.merchantId)} />
            <MetaField label="Items" value={cart.items.length} />
            <div style={{ marginLeft: 'auto' }}>
              <MetaField label="Total" value={`₹${grandTotal}`} />
            </div>
          </dl>

          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Order Items ({cart.items.length})</p>
            <div>
              {cart.items.map((it, i) => (
                <ItemRow
                  key={it.product.product_id}
                  first={i === 0}
                  src={it.product.images?.[0] || it.product.image}
                  alt={it.product.name}
                  name={it.product.name}
                  meta={`Qty ${it.quantity} · ₹${it.product.price} each`}
                  price={`₹${it.product.price * it.quantity}`}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, marginBottom: '18px' }}>
            <MapPinIcon size={15} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />
            <div style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4, color: RECEIPT.text }}>
              <strong>{address.label}</strong> — {address.line1}, {address.city}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Shipping Speed</p>
            {loading ? (
              <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>Checking delivery options for every item…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['standard', 'express'].map((id) => {
                  const active = id === speed;
                  const cost = (shippingBySpeed?.[id] || []).reduce((sum, s) => sum + s.cost, 0);
                  const etas = (shippingBySpeed?.[id] || []).map((s) => s.etaDays?.[1] || 0);
                  const worstEta = etas.length ? Math.max(...etas) : 0;
                  const bestEta = etas.length ? Math.min(...(shippingBySpeed?.[id] || []).map((s) => s.etaDays?.[0] || 0)) : 0;
                  const unitLabel = (shippingBySpeed?.[id] || [])[0]?.etaUnit === 'minutes' ? 'minutes' : 'business days';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSpeed(id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                        padding: '11px 14px',
                        borderRadius: 'var(--radius)',
                        border: active ? '1.5px solid var(--color-blue)' : `1.5px solid ${RECEIPT.panelBorder}`,
                        background: active ? 'rgba(13,148,251,0.08)' : '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text }}>{id === 'standard' ? 'Standard' : 'Express'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>
                          {bestEta}-{worstEta} {unitLabel} · each item ships separately
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="gauge-number" style={{ fontWeight: 700, color: RECEIPT.text }}>₹{cost}</span>
                        {active && <CheckIcon size={13} style={{ color: 'var(--color-blue)' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {minEta > 0 && (
              <p style={{ fontSize: '0.65rem', color: RECEIPT.textMuted, marginTop: '8px' }}>
                Estimated {minEta}-{maxEta} {shippingForSpeed[0]?.etaUnit === 'minutes' ? 'minutes' : 'business days'} overall, depending on the item.
              </p>
            )}
          </div>

          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Coupon</p>
            <CouponPicker cart={{ merchantId: cart.merchantId, items: couponCartItems }} applied={coupon} onApply={setCoupon} onClear={() => setCoupon(null)} fieldInput={fieldInput} />
          </div>

          <Panel title="Order Summary">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <SummaryRow label="Subtotal" value={`₹${itemsSubtotal}`} />
              <SummaryRow label="Shipping" value={`₹${shippingTotal}`} />
              {coupon && <SummaryRow label={`Discount (${coupon.code})`} value={`-₹${coupon.discount}`} />}
              <SummaryRow label="Total" value={`₹${grandTotal}`} strong accent />
            </div>
          </Panel>
        </LightCard>
      </div>
    </div>
  );
}
