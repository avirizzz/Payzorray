import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { getAnalytics } from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import { BarSeries, RankedBars, Donut } from '../components/charts/Charts';

const WINDOWS = [7, 30, 90];

function Metric({ label, value, sub, tone }) {
  return (
    <div style={{ flex: '1 1 150px', padding: 'var(--space-2) var(--space-3)' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '4px' }}>
        {label}
      </div>
      <div className="gauge-number" style={{ fontSize: 'var(--text-xl)', fontWeight: 800, lineHeight: 1.1, color: tone || '#fff' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', opacity: 0.75, marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <span className="page-eyebrow" style={{ margin: 0 }}>{title}</span>
        {hint && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', opacity: 0.75 }}>{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

export default function StatsPage() {
  const { merchantId } = useMerchant();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!merchantId) return;
    setData(null);
    setError(null);
    getAnalytics(merchantId, days).then(setData).catch((err) => setError(err.message));
  }, [merchantId, days]);

  const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860 }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Everything, measured</span>
          <h1 className="page-title">Store stats</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={days === w ? 'ask-btn press-on-active' : 'ask-btn press-on-active'}
                style={days === w ? { background: '#0d94fb', borderColor: '#0d94fb' } : undefined}
              >
                Last {w} days
              </button>
            ))}
          </div>
        </header>

        {error && (
          <Alert variant="destructive" title="Couldn't load your stats">
            {error}
          </Alert>
        )}

        {!error && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Skeleton style={{ height: 96, borderRadius: 'var(--radius-panel)' }} />
            <Skeleton style={{ height: 210, borderRadius: 'var(--radius-panel)' }} />
            <Skeleton style={{ height: 210, borderRadius: 'var(--radius-panel)' }} />
          </div>
        )}

        {!error && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Card variant="soft" style={{ display: 'flex', flexWrap: 'wrap', padding: 0, overflow: 'hidden' }}>
              <Metric label="Revenue" value={money(data.totals.revenue)} sub={`${data.totals.units_sold} units sold`} />
              <Metric label="Paid orders" value={data.totals.orders} sub={`${data.payments.success_rate_pct}% payment success`} />
              <Metric label="Avg order" value={money(data.totals.average_order_value)} />
              <Metric label="Customers" value={data.totals.unique_customers} sub={`${money(data.totals.revenue_per_customer)} each`} />
            </Card>

            <Section title={`Revenue · last ${data.window_days} days`} hint="Each bar is one day of real completed orders.">
              <BarSeries data={data.series} />
            </Section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-2)' }}>
              <Section title="Payments" hint="Where checkout attempts ended up.">
                <Donut
                  centerValue={`${data.payments.success_rate_pct}%`}
                  centerLabel="SUCCESS"
                  segments={[
                    { label: 'Completed', value: data.payments.completed, color: '#2fd68f' },
                    { label: 'Failed', value: data.payments.failed, color: '#ff6b6b' },
                    { label: 'Refunded', value: data.payments.refunded, color: '#ffc857' },
                    { label: 'Cancelled', value: data.payments.cancelled, color: 'rgba(255,255,255,0.5)' }
                  ]}
                />
                {data.payments.revenue_lost_to_failures > 0 && (
                  <p style={{ margin: '12px 0 0', fontSize: 'var(--text-xs)', opacity: 0.85 }}>
                    <strong className="gauge-number" style={{ color: '#ff6b6b' }}>
                      {money(data.payments.revenue_lost_to_failures)}
                    </strong>{' '}
                    didn't land because payments failed.
                  </p>
                )}
              </Section>

              <Section title="Top products" hint="By revenue from completed orders.">
                <RankedBars rows={data.top_products.slice(0, 6)} />
              </Section>

              <Section title="Categories" hint="Where the money actually comes from.">
                <RankedBars rows={data.top_categories.slice(0, 6)} />
              </Section>

              <Section title="Customers & fulfilment">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-sm)' }}>
                  <Line label="Repeat customers" value={`${data.totals.repeat_customers} of ${data.totals.unique_customers} (${data.totals.repeat_rate_pct}%)`} />
                  <Line label="Shipping collected" value={money(data.fulfilment.shipping_collected)} />
                  <Line label="Discounts given" value={money(data.fulfilment.discounts_given)} />
                  <Line label="Orders with a coupon" value={data.fulfilment.orders_with_coupon} />
                </div>
              </Section>
            </div>

            <Section title="Inventory" hint="Stock that could stop you selling.">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: data.inventory.low_stock_products.length ? 'var(--space-2)' : 0 }}>
                <Metric label="Out of stock" value={data.inventory.out_of_stock} tone={data.inventory.out_of_stock ? '#ff6b6b' : undefined} />
                <Metric label="Low stock" value={data.inventory.low_stock_count} tone={data.inventory.low_stock_count ? '#ffc857' : undefined} />
                <Metric label="Units in stock" value={data.inventory.total_stock_units.toLocaleString('en-IN')} />
              </div>
              {data.inventory.low_stock_products.length > 0 && (
                <RankedBars
                  rows={data.inventory.low_stock_products.map((p) => ({ name: p.name, revenue: p.stock }))}
                  prefix=""
                />
              )}
            </Section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Line({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
      <span style={{ opacity: 0.85, fontSize: 'var(--text-xs)' }}>{label}</span>
      <span className="gauge-number" style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{value}</span>
    </div>
  );
}
