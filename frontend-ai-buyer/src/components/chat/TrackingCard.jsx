import { Link } from 'react-router-dom';
import { getBulkInvoiceUrl } from '../../api/client';
import { DownloadIcon } from '../ui/icons';
import { LightCard, MetaField, Panel, ItemRow, SummaryRow, LightButton, RECEIPT } from './LightCard';

const STAGES = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];

// Invoice grouped server-side by approval_id, not per line item.
export default function TrackingCard({ orderId, amount, paymentId, approvalId, lineItems, customerId, customerName, customerPhone, address, date, stage = 'Confirmed', onDismiss }) {
  const activeIndex = Math.max(0, STAGES.findIndex((s) => s.toUpperCase() === String(stage).toUpperCase()));
  const items = lineItems || [];
  const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  const shippingTotal = items.reduce((sum, it) => sum + (it.shipping?.cost || 0), 0);
  const discountTotal = items.reduce((sum, it) => sum + (it.discount?.discount || 0), 0);
  const shippingLabel = items.find((it) => it.shipping?.label)?.shipping?.label;
  const dateLabel = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div style={{ padding: '4px var(--space-2) var(--space-2)' }}>
      <LightCard
        title="Order Confirmation"
        badge="Paid"
        maxWidth="440px"
        footer={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, wordBreak: 'break-all' }}>Payment ID: {paymentId}</p>
              {customerId && approvalId && (
                <a
                  href={getBulkInvoiceUrl(approvalId, customerId)}
                  target="_blank"
                  rel="noreferrer"
                  className="press-on-active"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-blue)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                >
                  <DownloadIcon size={11} />
                  Download Invoice
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <LightButton variant="ghost" onClick={onDismiss} style={{ flex: 1 }}>
                Dismiss
              </LightButton>
              <Link to="/orders" style={{ flex: 1 }} onClick={onDismiss}>
                <LightButton variant="primary" style={{ width: '100%' }}>
                  View Orders
                </LightButton>
              </Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', paddingTop: '4px', opacity: 0.85 }}>
              <span style={{ fontSize: '0.64rem', color: RECEIPT.textMuted }}>Powered by</span>
              <img src="/payzorray-logo.png" alt="Payzorray" style={{ height: '15px', width: 'auto', display: 'block' }} />
            </div>
          </div>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: RECEIPT.text, marginBottom: '16px' }}>Thanks for shopping with RazeGPT!</p>

        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', margin: '0 0 18px' }}>
          <MetaField label="Order Number" value={items.length > 1 ? `${items.length} orders` : orderId} />
          {dateLabel && <MetaField label="Date" value={dateLabel} />}
          <div style={{ marginLeft: 'auto' }}>
            <MetaField label="Total" value={`₹${amount}`} />
          </div>
        </dl>

        {address && (
          <div style={{ marginBottom: '18px' }}>
            <Panel title="Shipping Information">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {customerName && <MetaField label="Customer" value={customerName} />}
                {shippingLabel && <MetaField label="Shipping Method" value={shippingLabel} />}
                <MetaField label="Address" value={`${address.label} — ${address.line1}, ${address.city}`} />
                {customerPhone && <MetaField label="Phone" value={customerPhone} />}
              </div>
            </Panel>
          </div>
        )}

        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Order Items ({items.length})</p>
          <div>
            {items.map((it, i) => (
              <ItemRow
                key={it.orderId + it.productId}
                first={i === 0}
                src={it.productImage}
                alt={it.productName}
                name={it.productName}
                meta={`Qty ${it.quantity} · ₹${it.unitPrice} each`}
                price={`₹${it.unitPrice * it.quantity}`}
              />
            ))}
          </div>
        </div>

        <Panel title="Order Summary" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <SummaryRow label="Subtotal" value={`₹${subtotal}`} />
            <SummaryRow label="Shipping" value={`₹${shippingTotal}`} />
            {discountTotal > 0 && <SummaryRow label="Discount" value={`-₹${discountTotal}`} />}
            <SummaryRow label="Total" value={`₹${amount}`} strong accent />
          </div>
        </Panel>

        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Delivery Status</p>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STAGES.map((label, i) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <div
                  style={{
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    margin: '0 auto 5px',
                    background: i <= activeIndex ? 'var(--color-blue)' : '#ffffff',
                    border: '2px solid var(--color-blue)'
                  }}
                />
                <span style={{ fontSize: '0.62rem', color: i <= activeIndex ? RECEIPT.text : RECEIPT.textMuted, fontWeight: i === activeIndex ? 700 : 500 }}>{label}</span>
                {i < STAGES.length - 1 && <div style={{ position: 'absolute', top: '6px', left: '55%', width: '90%', height: '2px', background: RECEIPT.divider, zIndex: -1 }} />}
              </div>
            ))}
          </div>
        </div>
      </LightCard>
    </div>
  );
}
