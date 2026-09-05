import { BarSeries, RankedBars, Donut } from '../charts/Charts';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Same analytics object backs the chart and the agent's reply.
export default function StatsCard({ analytics, view = 'overview' }) {
  if (!analytics) return null;

  const title =
    { overview: 'Overview', revenue: `Revenue · last ${analytics.window_days} days`, products: 'Top products', categories: 'Top categories', payments: 'Payments', customers: 'Customers', inventory: 'Inventory' }[view] ||
    'Overview';

  return (
    <div className="glass-card glass-card-row" style={{ padding: 'var(--space-2) var(--space-3)', width: '100%' }}>
      <div className="page-eyebrow" style={{ marginBottom: '12px' }}>{title}</div>

      {view === 'overview' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Stat label="Revenue" value={money(analytics.totals.revenue)} />
          <Stat label="Orders" value={analytics.totals.orders} />
          <Stat label="Avg order" value={money(analytics.totals.average_order_value)} />
          <Stat label="Customers" value={analytics.totals.unique_customers} />
        </div>
      )}

      {view === 'revenue' && <BarSeries data={analytics.series} />}
      {view === 'products' && <RankedBars rows={analytics.top_products.slice(0, 6)} />}
      {view === 'categories' && <RankedBars rows={analytics.top_categories.slice(0, 6)} />}

      {view === 'payments' && (
        <Donut
          centerValue={`${analytics.payments.success_rate_pct}%`}
          centerLabel="SUCCESS"
          segments={[
            { label: 'Completed', value: analytics.payments.completed, color: '#2fd68f' },
            { label: 'Failed', value: analytics.payments.failed, color: '#ff6b6b' },
            { label: 'Refunded', value: analytics.payments.refunded, color: '#ffc857' },
            { label: 'Cancelled', value: analytics.payments.cancelled, color: 'rgba(255,255,255,0.5)' }
          ]}
        />
      )}

      {view === 'customers' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Stat label="Unique" value={analytics.totals.unique_customers} />
          <Stat label="Repeat" value={`${analytics.totals.repeat_customers} (${analytics.totals.repeat_rate_pct}%)`} />
          <Stat label="Revenue each" value={money(analytics.totals.revenue_per_customer)} />
        </div>
      )}

      {view === 'inventory' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <Stat label="Out of stock" value={analytics.inventory.out_of_stock} />
          <Stat label="Low stock" value={analytics.inventory.low_stock_count} />
          <Stat label="Units in stock" value={analytics.inventory.total_stock_units.toLocaleString('en-IN')} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75 }}>{label}</div>
      <div className="gauge-number" style={{ fontSize: 'var(--text-md)', fontWeight: 800, marginTop: '2px' }}>{value}</div>
    </div>
  );
}
