import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, LightButton } from './LightCard';
import CartItems from './CartItems';
import CartInsightPanel from './CartInsightPanel';

// Distinct from CartInlineCard: this popup is only for add-to-cart moments.
export default function CartPopup({ cart, onRemove, onQtyChange, onCheckout, onClose, customerId, onPreview }) {
  if (!cart?.items?.length) return null;
  const subtotal = cart.items.reduce((sum, it) => sum + it.product.price * it.quantity, 0);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(1,38,82,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-2)' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}>
        <LightCard
          title="Your Cart"
          badge={merchantName(cart.merchantId)}
          onClose={onClose}
          maxWidth="400px"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <LightButton variant="ghost" onClick={onClose} style={{ flex: 1 }}>
                Keep shopping
              </LightButton>
              <LightButton variant="primary" onClick={onCheckout} style={{ flex: 1 }}>
                Checkout · ₹{subtotal}
              </LightButton>
            </div>
          }
        >
          <CartItems cart={cart} onRemove={onRemove} onQtyChange={onQtyChange} onPreview={onPreview} />
          <p style={{ fontSize: '0.72rem', color: 'rgba(1,38,82,0.62)', marginTop: '4px' }}>Keep adding from {merchantName(cart.merchantId)}, or check out when ready.</p>
          <CartInsightPanel cart={cart} customerId={customerId} />
        </LightCard>
      </div>
    </div>
  );
}
