import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { getMerchantStats, getReadiness, getFlaggedEvents, getDiagnosis } from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import { AlertIcon, SparkleIcon } from '../components/ui/icons';
import { Link as RouterLink } from 'react-router-dom';

const READINESS_ATTENTION_THRESHOLD = 60;

const EVENT_LABEL = {
  CREATE_ORDER: 'Payment failed',
  CANCEL_ORDER: 'Order cancelled',
  REFUND_ORDER: 'Refund issued',
  WEBHOOK_REFUND_CREATED: 'Refund confirmed by Razorpay'
};

function StatTile({ value, label }) {
  return (
    <div style={{ flex: '1 1 140px', textAlign: 'center', padding: 'var(--space-2)' }}>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', opacity: 0.75 }}>
        {label}
      </div>
    </div>
  );
}

function Finding({ label, value, detail, tone, to }) {
  const body = (
    <Card variant="soft" dense className={to ? 'row-hover' : ''} style={{ padding: 'var(--space-2) var(--space-3)', height: '100%', cursor: to ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '5px' }}>{label}</div>
      <div className="gauge-number" style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: tone || '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', opacity: 0.78, marginTop: '3px' }}>{detail}</div>
    </Card>
  );
  return to ? <RouterLink to={to} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</RouterLink> : body;
}

export default function HomePage() {
  const { merchantId } = useMerchant();
  const [stats, setStats] = useState(null);
  const [needsAttention, setNeedsAttention] = useState(null);
  const [events, setEvents] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!merchantId) return;
    setStats(null);
    setNeedsAttention(null);
    setEvents(null);
    setDiagnosis(null);
    setError(null);

    // Fetched separately: readiness/diagnosis run slow LLM grading passes.
    getMerchantStats(merchantId).then(setStats).catch((err) => setError(err.message));
    getFlaggedEvents(merchantId).then(setEvents).catch(() => setEvents([]));

    getReadiness(merchantId)
      .then(({ products }) =>
        setNeedsAttention({
          count: products.filter((p) => p.score !== null && p.score < READINESS_ATTENTION_THRESHOLD).length,
          total: products.length
        })
      )
      .catch(() => setNeedsAttention(null));

    getDiagnosis(merchantId).then(setDiagnosis).catch(() => setDiagnosis(null));
  }, [merchantId]);

  return (
    <DashboardLayout>
      <header style={{ marginBottom: 'var(--space-3)' }}>
        <span className="page-eyebrow">{merchantId}</span>
        <h1 className="page-title">Store overview</h1>
      </header>

      {error && (
        <Alert variant="destructive" title="Couldn't load your store">
          {error}
        </Alert>
      )}

      {!error && (
        <>
          <Card
            variant="soft"
            style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 'var(--space-3)', padding: 0, overflow: 'hidden' }}
          >
            {stats ? (
              <>
                <StatTile value={`₹${stats.revenue}`} label="Revenue" />
                <StatTile value={stats.order_count} label="Orders" />
                <StatTile value={`₹${stats.average_order_value}`} label="Avg order value" />
                <StatTile value={stats.catalog_size} label="Products" />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => (
                <div key={i} style={{ flex: '1 1 140px', padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Skeleton style={{ width: 64, height: 28 }} />
                  <Skeleton style={{ width: 56, height: 10 }} />
                </div>
              ))
            )}
          </Card>

          <Link to="/catalog" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Card
              variant="soft"
              style={{
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer'
              }}
            >
              <AlertIcon size={18} />
              {needsAttention ? (
                <span>
                  <strong>{needsAttention.count}</strong> of <strong>{needsAttention.total}</strong> products need attention in your
                  catalog &rarr;
                </span>
              ) : (
                <Skeleton style={{ width: 220, height: 14 }} />
              )}
            </Card>
          </Link>

          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>What's holding the store back</h2>
          {!diagnosis && <Skeleton style={{ height: 120, marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-panel)' }} />}
          {diagnosis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Finding
                label="Revenue concentration"
                value={`${diagnosis.concentration.top_product_revenue_share_pct}%`}
                tone={diagnosis.concentration.top_product_revenue_share_pct >= 40 ? '#ffc857' : undefined}
                detail={diagnosis.concentration.top_product ? `from "${diagnosis.concentration.top_product}"` : 'no sales yet'}
              />
              <Finding
                label="Never sold"
                value={`${diagnosis.concentration.never_sold_count} of ${diagnosis.concentration.catalog_size}`}
                tone={diagnosis.concentration.never_sold_share_pct >= 50 ? '#ff6b6b' : undefined}
                detail={`${diagnosis.concentration.never_sold_share_pct}% of your catalog`}
              />
              <Finding
                label="Unsold & hard to find"
                value={diagnosis.unsold_and_hard_to_find.total_matching}
                tone={diagnosis.unsold_and_hard_to_find.counts_by_band.critical ? '#ff6b6b' : undefined}
                detail={`${diagnosis.unsold_and_hard_to_find.counts_by_band.critical} critical`}
                to="/catalog"
              />
              <Finding
                label="Lost to failed payments"
                value={`₹${diagnosis.revenue_lost_to_failed_payments}`}
                tone={diagnosis.revenue_lost_to_failed_payments > 0 ? '#ff6b6b' : undefined}
                detail="never reached your account"
              />
            </div>
          )}

          {diagnosis?.best_sellers_low_on_stock?.length > 0 && (
            <Card variant="soft" style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)' }}>
              <span className="page-eyebrow">Best sellers running low</span>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {diagnosis.best_sellers_low_on_stock.slice(0, 4).map((p) => (
                  <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span className="gauge-number" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#ffc857' }}>
                      {p.stock} left · {p.units_sold} sold
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {diagnosis?.suggested_campaigns?.length > 0 && (
            <RouterLink to="/campaigns" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card variant="soft" dense className="row-hover" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <SparkleIcon size={16} />
                <span style={{ fontSize: 'var(--text-sm)' }}>
                  <strong>{diagnosis.suggested_campaigns.length}</strong> campaign{diagnosis.suggested_campaigns.length === 1 ? '' : 's'} suggested from this data &rarr;
                </span>
              </Card>
            </RouterLink>
          )}

          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Recent activity worth a look</h2>
          {events === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} style={{ height: 56 }} />
              ))}
            </div>
          )}
          {events && events.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Nothing flagged recently.</p>}
          {events && events.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {events.map((e, i) => (
                <Card key={i} variant="soft" dense style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{EVENT_LABEL[e.action] || e.action}</strong>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                      {e.product_id} · {e.reason}
                    </p>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
