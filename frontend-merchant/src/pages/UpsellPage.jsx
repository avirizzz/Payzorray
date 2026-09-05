import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { getUpsellPerformance } from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import { Donut, RankedBars } from '../components/charts/Charts';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

const ACTION_LABEL = {
  UPSELL_OFFERED: { text: 'Offered', color: 'rgba(255,255,255,0.75)' },
  UPSELL_ACCEPTED: { text: 'Accepted', color: '#2fd68f' },
  UPSELL_DECLINED: { text: 'Declined', color: '#ff6b6b' }
};

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

export default function UpsellPage() {
  const { merchantId } = useMerchant();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!merchantId) return;
    setStats(null);
    setError(null);
    getUpsellPerformance(merchantId).then(setStats).catch((err) => setError(err.message));
  }, [merchantId]);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860 }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Checkout add-ons</span>
          <h1 className="page-title">Upsell performance</h1>
          <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', opacity: 0.9, maxWidth: 560 }}>
            What happened when the agent offered a second item alongside something already in the cart.
          </p>
        </header>

        {error && <Alert variant="destructive" title="Couldn't load upsell data">{error}</Alert>}

        {!error && !stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Skeleton style={{ height: 96, borderRadius: 'var(--radius-panel)' }} />
            <Skeleton style={{ height: 200, borderRadius: 'var(--radius-panel)' }} />
          </div>
        )}

        {!error && stats && !stats.has_activity && (
          <Card variant="soft" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>No add-on offers yet</p>
            <p style={{ margin: '0 0 16px', fontSize: 'var(--text-sm)', opacity: 0.85 }}>
              {stats.total_bundles > 0
                ? "You have bundle campaigns set up — this fills in as soon as a shopper reaches checkout with a matching product."
                : 'Create a bundle campaign to pair one of your products with another, and offers will start appearing here.'}
            </p>
            <Link to="/campaigns" style={{ textDecoration: 'none' }}>
              <button type="button" className="ask-btn press-on-active" style={{ display: 'inline-flex' }}>
                Go to campaigns
              </button>
            </Link>
          </Card>
        )}

        {!error && stats?.has_activity && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Card variant="soft" style={{ display: 'flex', flexWrap: 'wrap', padding: 0, overflow: 'hidden' }}>
              <Metric label="Offered" value={stats.offered} />
              <Metric label="Accepted" value={stats.accepted} tone="#2fd68f" />
              <Metric label="Declined" value={stats.declined} tone={stats.declined ? '#ff6b6b' : undefined} />
              <Metric label="Extra revenue" value={money(stats.revenue_from_accepted)} sub="from accepted add-ons" />
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-2)' }}>
              <Section title="Outcomes" hint="Every offer the agent has made.">
                <Donut
                  centerValue={`${stats.acceptance_rate}%`}
                  centerLabel="ACCEPTED"
                  segments={[
                    { label: 'Accepted', value: stats.accepted, color: '#2fd68f' },
                    { label: 'Declined', value: stats.declined, color: '#ff6b6b' },
                    { label: 'No response', value: Math.max(0, stats.offered - stats.accepted - stats.declined), color: 'rgba(255,255,255,0.45)' }
                  ]}
                />
              </Section>

              <Section title="What drove the offer" hint="Your bundle campaigns vs. the agent's generic same-category suggestion.">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { key: 'bundle_campaign', label: 'Your bundle campaigns' },
                    { key: 'category_fallback', label: 'Generic category match' }
                  ].map(({ key, label }) => {
                    const s = stats.by_source[key];
                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: 'var(--text-xs)' }}>
                          <span>{label}</span>
                          <span className="gauge-number" style={{ fontWeight: 700 }}>
                            {s.accepted}/{s.offered} · {s.acceptance_rate}%
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.16)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${s.acceptance_rate}%`, height: '100%', background: '#2fd68f' }} />
                        </div>
                      </div>
                    );
                  })}
                  <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.75 }}>
                    {stats.active_bundles} active bundle campaign{stats.active_bundles === 1 ? '' : 's'} ·{' '}
                    <Link to="/campaigns" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>manage</Link>
                  </p>
                </div>
              </Section>
            </div>

            {stats.by_product.length > 0 && (
              <Section title="Most offered add-ons" hint="Times each product was offered alongside something else.">
                <RankedBars rows={stats.by_product.map((p) => ({ name: p.name, revenue: p.offered }))} prefix="" />
              </Section>
            )}

            <Section title="Recent activity">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {stats.recent.map((r, i) => {
                  const label = ACTION_LABEL[r.action] || { text: r.action, color: '#fff' };
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: '9px 0',
                        borderTop: i ? '1px solid rgba(255,255,255,0.12)' : 'none'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <span style={{ color: label.color, fontWeight: 700, fontSize: 'var(--text-xs)' }}>{label.text}</span>
                        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}> · {r.product_name}</span>
                        {r.source === 'bundle_campaign' && (
                          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}> · from your bundle</span>
                        )}
                      </div>
                      <span className="gauge-number" style={{ fontSize: '0.72rem', opacity: 0.75, whiteSpace: 'nowrap' }}>
                        {r.amount != null ? `${money(r.amount)} · ` : ''}
                        {new Date(r.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
