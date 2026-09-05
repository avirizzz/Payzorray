import { useState } from 'react';

// Merchant submits explicitly; agent never auto-creates campaigns.
const field = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)'
};

function Label({ children }) {
  return (
    <span style={{ display: 'block', fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>
      {children}
    </span>
  );
}

export default function CampaignFormCard({ kind, products, categories, onSubmit, disabled, done }) {
  const [coupon, setCoupon] = useState({ code: '', discount_type: 'percent', discount_value: 10, scope_type: 'all', scope_value: '' });
  const [bundle, setBundle] = useState({ primary_product_id: '', paired_product_id: '', discount_type: 'percent', discount_value: 15 });

  if (done) {
    return (
      <div className="glass-card glass-card-row" style={{ padding: 'var(--space-2)', width: '100%', opacity: 0.7 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>Campaign created.</p>
      </div>
    );
  }

  const isCoupon = kind === 'coupon';

  function submit(e) {
    e.preventDefault();
    onSubmit(isCoupon ? { kind: 'coupon', ...coupon } : { kind: 'bundle', ...bundle });
  }

  return (
    <form onSubmit={submit} className="glass-card glass-card-row" style={{ padding: 'var(--space-2)', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.85 }}>
        {isCoupon ? 'New coupon campaign' : 'New bundle campaign'}
      </span>

      {isCoupon ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label>
              <Label>Code</Label>
              <input style={field} value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} placeholder="SUMMER10" required />
            </label>
            <label>
              <Label>Discount</Label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select style={{ ...field, flex: 1 }} value={coupon.discount_type} onChange={(e) => setCoupon({ ...coupon, discount_type: e.target.value })}>
                  <option value="percent">%</option>
                  <option value="flat">₹</option>
                </select>
                <input style={{ ...field, flex: 1 }} type="number" min="1" value={coupon.discount_value} onChange={(e) => setCoupon({ ...coupon, discount_value: e.target.value })} required />
              </div>
            </label>
          </div>
          <label>
            <Label>Applies to</Label>
            <select style={field} value={coupon.scope_type} onChange={(e) => setCoupon({ ...coupon, scope_type: e.target.value, scope_value: '' })}>
              <option value="all">My whole catalog</option>
              <option value="category">One category</option>
              <option value="product">One product</option>
            </select>
          </label>
          {coupon.scope_type !== 'all' && (
            <label>
              <Label>{coupon.scope_type === 'category' ? 'Category' : 'Product'}</Label>
              <select style={field} value={coupon.scope_value} onChange={(e) => setCoupon({ ...coupon, scope_value: e.target.value })} required>
                <option value="">Choose…</option>
                {coupon.scope_type === 'category'
                  ? categories.map((c) => <option key={c} value={c}>{c}</option>)
                  : products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
              </select>
            </label>
          )}
        </>
      ) : (
        <>
          <label>
            <Label>When they buy</Label>
            <select style={field} value={bundle.primary_product_id} onChange={(e) => setBundle({ ...bundle, primary_product_id: e.target.value })} required>
              <option value="">Choose…</option>
              {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            <Label>Offer this at a discount</Label>
            <select style={field} value={bundle.paired_product_id} onChange={(e) => setBundle({ ...bundle, paired_product_id: e.target.value })} required>
              <option value="">Choose…</option>
              {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            <Label>Discount</Label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select style={{ ...field, flex: 1 }} value={bundle.discount_type} onChange={(e) => setBundle({ ...bundle, discount_type: e.target.value })}>
                <option value="percent">%</option>
                <option value="flat">₹</option>
              </select>
              <input style={{ ...field, flex: 1 }} type="number" min="1" value={bundle.discount_value} onChange={(e) => setBundle({ ...bundle, discount_value: e.target.value })} required />
            </div>
          </label>
        </>
      )}

      <button type="submit" className="ask-btn press-on-active" disabled={disabled} style={{ alignSelf: 'flex-start' }}>
        Create campaign
      </button>
    </form>
  );
}
