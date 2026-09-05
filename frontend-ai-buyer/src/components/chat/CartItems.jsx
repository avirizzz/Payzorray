import { PlusIcon, MinusIcon, TrashIcon } from '../ui/icons';
import { ItemRow, SummaryRow, RECEIPT } from './LightCard';

export default function CartItems({ cart, onRemove, onQtyChange, onPreview }) {
  const subtotal = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  return (
    <>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Items ({cart.items.length})</p>
      <div style={{ marginBottom: '14px' }}>
        {cart.items.map((it, i) => (
          <ItemRow
            key={it.product.product_id}
            first={i === 0}
            src={it.product.images?.[0] || it.product.image}
            alt={it.product.name}
            name={
              onPreview ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => onPreview(it.product.product_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPreview(it.product.product_id);
                    }
                  }}
                  style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: RECEIPT.panelBorder, textUnderlineOffset: '2px' }}
                >
                  {it.product.name}
                </span>
              ) : (
                it.product.name
              )
            }
            price={`₹${it.product.price * it.quantity}`}
            right={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: 'var(--radius-pill)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => onQtyChange(it.product.product_id, -1)}
                    className="press-on-active"
                    aria-label="Decrease quantity"
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: RECEIPT.text, borderRadius: '50%', cursor: 'pointer' }}
                  >
                    <MinusIcon size={9} />
                  </button>
                  <span className="gauge-number" style={{ minWidth: '16px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: RECEIPT.text }}>{it.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onQtyChange(it.product.product_id, 1)}
                    className="press-on-active"
                    aria-label="Increase quantity"
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: RECEIPT.text, borderRadius: '50%', cursor: 'pointer' }}
                  >
                    <PlusIcon size={9} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(it.product.product_id)}
                  className="press-on-active"
                  aria-label={`Remove ${it.product.name}`}
                  style={{ width: '26px', height: '26px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: '50%', background: '#ffffff', color: '#c73737', cursor: 'pointer' }}
                >
                  <TrashIcon size={11} />
                </button>
              </div>
            }
          />
        ))}
      </div>
      <SummaryRow label="Subtotal" value={`₹${subtotal}`} strong accent />
      {/* Final price is re-derived server-side; may be lower. */}
      {cart.items.some((it) => it.bundlePrimaryProductId) && (
        <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginTop: '8px' }}>
          Includes a seller bundle discount, applied at payment.
        </p>
      )}
    </>
  );
}
