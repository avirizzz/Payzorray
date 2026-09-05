import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import {
  listCampaigns,
  createCouponCampaign,
  createBundleCampaign,
  setCouponCampaignActive,
  setBundleCampaignActive,
  getDiagnosis,
  getReadiness
} from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import { SparkleIcon } from '../components/ui/icons';

const field = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-xs)'
};

function Label({ children }) {
  return (
    <span style={{ display: 'block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '5px' }}>
      {children}
    </span>
  );
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-2)' }}>{children}</div>;
}

export default function CampaignsPage() {
  const { merchantId } = useMerchant();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [busy, setBusy] = useState(false);

  const [coupon, setCoupon] = useState({ code: '', discount_type: 'percent', discount_value: 10, scope_type: 'all', scope_value: '', min_order_amount: 0, expires_at: '' });
  const [bundle, setBundle] = useState({ primary_product_id: '', paired_product_id: '', discount_type: 'percent', discount_value: 15, expires_at: '' });

  const refresh = useCallback(() => {
    if (!merchantId) return;
    listCampaigns(merchantId).then(setData).catch((e) => setError(e.message));
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;
    setData(null);
    setError(null);
    refresh();
    getReadiness(merchantId).then(({ products: fetched }) => setProducts(fetched)).catch(() => setProducts([]));
    getDiagnosis(merchantId)
      .then((d) => setSuggestions(d.suggested_campaigns || []))
      .catch(() => setSuggestions([]));
  }, [merchantId, refresh]);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  async function run(fn, successMessage) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(successMessage);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function submitCoupon(e) {
    e.preventDefault();
    run(
      () =>
        createCouponCampaign({
          merchant_id: merchantId,
          code: coupon.code.trim().toUpperCase(),
          discount_type: coupon.discount_type,
          discount_value: Number(coupon.discount_value),
          min_order_amount: Number(coupon.min_order_amount) || 0,
          scope_type: coupon.scope_type,
          scope_value: coupon.scope_type === 'all' ? null : coupon.scope_value,
          expires_at: coupon.expires_at || null
        }),
      `Coupon campaign ${coupon.code.toUpperCase()} created.`
    );
  }

  function submitBundle(e) {
    e.preventDefault();
    run(
      () =>
        createBundleCampaign({
          merchant_id: merchantId,
          primary_product_id: bundle.primary_product_id,
          paired_product_id: bundle.paired_product_id,
          discount_type: bundle.discount_type,
          discount_value: Number(bundle.discount_value),
          expires_at: bundle.expires_at || null
        }),
      'Bundle campaign created.'
    );
  }

  // Suggestions submit through the same creation call as manual forms.
  function approve(s) {
    if (s.kind === 'coupon') {
      const code = `${s.scope_type === 'product' ? 'PROD' : 'CAT'}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      run(
        () =>
          createCouponCampaign({
            merchant_id: merchantId,
            code,
            description: s.reason,
            discount_type: s.suggested_discount_type,
            discount_value: s.suggested_discount_value,
            scope_type: s.scope_type,
            scope_value: s.scope_value
          }),
        `Created coupon ${code} from suggestion.`
      );
    } else {
      run(
        () =>
          createBundleCampaign({
            merchant_id: merchantId,
            primary_product_id: s.primary_product_id,
            paired_product_id: s.paired_product_id,
            discount_type: s.suggested_discount_type,
            discount_value: s.suggested_discount_value
          }),
        'Created bundle campaign from suggestion.'
      );
    }
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 820 }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Offers, not rankings</span>
          <h1 className="page-title">Campaigns</h1>
          <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', opacity: 0.9, maxWidth: 560 }}>
            Campaigns add an optional discount a buyer can choose to apply. They never change which products an AI shopper
            finds or how those results are ranked.
          </p>
        </header>

        {error && <Alert variant="destructive" title="That didn't work" style={{ marginBottom: 'var(--space-2)' }}>{error}</Alert>}
        {notice && <Alert title="Done" style={{ marginBottom: 'var(--space-2)' }}>{notice}</Alert>}

        <Card variant="soft" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
            <SparkleIcon size={14} />
            <span className="page-eyebrow" style={{ margin: 0 }}>Suggested from your data</span>
          </div>

          {suggestions === null && <Skeleton style={{ height: 60 }} />}
          {suggestions?.length === 0 && (
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.8 }}>
              Nothing to suggest right now — no idle categories or unsold listings stood out.
            </p>
          )}
          {suggestions?.map((s, i) => (
            <div key={i} style={{ padding: '12px 0', borderTop: i ? '1px solid rgba(255,255,255,0.14)' : 'none' }}>
              <p style={{ margin: '0 0 4px', fontSize: 'var(--text-sm)' }}>{s.reason}</p>
              <p className="gauge-number" style={{ margin: '0 0 10px', fontSize: '0.72rem', opacity: 0.8 }}>
                {s.kind === 'coupon'
                  ? `Coupon · ${s.scope_type} "${s.scope_value}" · ${s.suggested_discount_value}% (range ${s.discount_range.min}-${s.discount_range.max}%)`
                  : `Bundle · ${s.primary_product_name} + ${s.paired_product_name} · ${s.suggested_discount_value}%`}
              </p>
              <button type="button" className="ask-btn press-on-active" disabled={busy} onClick={() => approve(s)}>
                Review &amp; create
              </button>
            </div>
          ))}
        </Card>

        <Card variant="soft" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <span className="page-eyebrow">New coupon campaign</span>
          <form onSubmit={submitCoupon} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: '12px' }}>
            <Row>
              <label>
                <Label>Code</Label>
                <input style={field} value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} placeholder="SUMMER10" required />
              </label>
              <label>
                <Label>Type</Label>
                <select style={field} value={coupon.discount_type} onChange={(e) => setCoupon({ ...coupon, discount_type: e.target.value })}>
                  <option value="percent">Percent</option>
                  <option value="flat">Flat ₹</option>
                </select>
              </label>
              <label>
                <Label>Value</Label>
                <input style={field} type="number" min="1" value={coupon.discount_value} onChange={(e) => setCoupon({ ...coupon, discount_value: e.target.value })} required />
              </label>
            </Row>
            <Row>
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
              <label>
                <Label>Min order ₹</Label>
                <input style={field} type="number" min="0" value={coupon.min_order_amount} onChange={(e) => setCoupon({ ...coupon, min_order_amount: e.target.value })} />
              </label>
            </Row>
            <button type="submit" className="ask-btn press-on-active" disabled={busy} style={{ alignSelf: 'flex-start' }}>
              Create coupon campaign
            </button>
          </form>
        </Card>

        <Card variant="soft" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
          <span className="page-eyebrow">New bundle campaign</span>
          <form onSubmit={submitBundle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: '12px' }}>
            <Row>
              <label>
                <Label>When they buy</Label>
                <select style={field} value={bundle.primary_product_id} onChange={(e) => setBundle({ ...bundle, primary_product_id: e.target.value })} required>
                  <option value="">Choose…</option>
                  {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
                </select>
              </label>
              <label>
                <Label>Offer this</Label>
                <select style={field} value={bundle.paired_product_id} onChange={(e) => setBundle({ ...bundle, paired_product_id: e.target.value })} required>
                  <option value="">Choose…</option>
                  {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
                </select>
              </label>
            </Row>
            <Row>
              <label>
                <Label>Type</Label>
                <select style={field} value={bundle.discount_type} onChange={(e) => setBundle({ ...bundle, discount_type: e.target.value })}>
                  <option value="percent">Percent</option>
                  <option value="flat">Flat ₹</option>
                </select>
              </label>
              <label>
                <Label>Value</Label>
                <input style={field} type="number" min="1" value={bundle.discount_value} onChange={(e) => setBundle({ ...bundle, discount_value: e.target.value })} required />
              </label>
            </Row>
            <button type="submit" className="ask-btn press-on-active" disabled={busy} style={{ alignSelf: 'flex-start' }}>
              Create bundle campaign
            </button>
          </form>
        </Card>

        <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
          <span className="page-eyebrow">Your campaigns</span>
          {!data && <Skeleton style={{ height: 60, marginTop: '12px' }} />}
          {data && data.coupon_campaigns.length === 0 && data.bundle_campaigns.length === 0 && (
            <p style={{ margin: '12px 0 0', fontSize: 'var(--text-xs)', opacity: 0.8 }}>No campaigns yet.</p>
          )}

          {data?.coupon_campaigns.map((c) => (
            <div key={c.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.14)' }}>
              <div>
                <strong className="gauge-number" style={{ fontSize: 'var(--text-sm)' }}>{c.code}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', opacity: 0.8 }}>
                  {c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`} ·{' '}
                  {c.scope_type === 'all' ? 'whole catalog' : `${c.scope_type}: ${c.scope_value}`}
                </p>
              </div>
              <button type="button" className="ask-btn press-on-active" disabled={busy}
                onClick={() => run(() => setCouponCampaignActive(c.code, merchantId, !c.active), `${c.code} ${c.active ? 'paused' : 'resumed'}.`)}>
                {c.active ? 'Pause' : 'Resume'}
              </button>
            </div>
          ))}

          {data?.bundle_campaigns.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.14)' }}>
              <div>
                <strong style={{ fontSize: 'var(--text-sm)' }}>Bundle</strong>
                <p className="gauge-number" style={{ margin: '2px 0 0', fontSize: '0.72rem', opacity: 0.8 }}>
                  {b.primary_product_id} + {b.paired_product_id} ·{' '}
                  {b.discount_type === 'percent' ? `${b.discount_value}%` : `₹${b.discount_value}`}
                </p>
              </div>
              <button type="button" className="ask-btn press-on-active" disabled={busy}
                onClick={() => run(() => setBundleCampaignActive(b.id, merchantId, !b.active), `Bundle ${b.active ? 'paused' : 'resumed'}.`)}>
                {b.active ? 'Pause' : 'Resume'}
              </button>
            </div>
          ))}
        </Card>
      </div>
    </DashboardLayout>
  );
}
