import { merchantName } from '../../hooks/useAiBuyerConversation';
import { LightCard, LightButton } from './LightCard';
import CartItems from './CartItems';

export default function CartInlineCard({ cart, onRemove, onQtyChange, onCheckout }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div
        aria-hidden="true"
        style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--gradient-accent)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700 }}
      >
        AI
      </div>
      <LightCard
        title="Your Cart"
        badge={merchantName(cart.merchantId)}
        maxWidth="400px"
        footer={
          <LightButton variant="primary" style={{ width: '100%' }} onClick={onCheckout}>
            Proceed to checkout
          </LightButton>
        }
      >
        <CartItems cart={cart} onRemove={onRemove} onQtyChange={onQtyChange} />
      </LightCard>
    </div>
  );
}
