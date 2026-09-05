import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { getReadiness } from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import ProductThumb from '../components/ui/ProductThumb';
import { SparkleIcon, ChatIcon } from '../components/ui/icons';

// Null score is its own band, never folded into ready.
const BANDS = [
  { key: 'critical', label: 'Critical', color: '#ff6b6b', test: (s) => s !== null && s < 40 },
  { key: 'needsWork', label: 'Needs work', color: '#ffc857', test: (s) => s !== null && s >= 40 && s < 70 },
  { key: 'ready', label: 'Ready', color: '#2fd68f', test: (s) => s !== null && s >= 70 },
  { key: 'ungraded', label: 'Not graded', color: 'rgba(255,255,255,0.45)', test: (s) => s === null }
];

function bandFor(score) {
  return BANDS.find((b) => b.test(score)) || BANDS[BANDS.length - 1];
}

function DistributionBar({ counts, total, active, onPick }) {
  return (
    <Card variant="soft" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <span className="page-eyebrow" style={{ margin: 0 }}>Catalog health</span>
        <span className="gauge-number" style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>{total} products</span>
      </div>

      <div
        style={{
          display: 'flex',
          height: 34,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.22)'
        }}
      >
        {BANDS.map((b) => {
          if (!counts[b.key]) return null;
          const pct = (counts[b.key] / total) * 100;
          return (
            <div
              key={b.key}
              title={`${counts[b.key]} ${b.label.toLowerCase()} (${Math.round(pct)}%)`}
              style={{
                width: `${pct}%`,
                background: b.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0
              }}
            >
              {/* Skip label if segment too narrow to hold it */}
              {pct >= 9 && (
                <span
                  className="gauge-number"
                  style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: 'var(--color-navy-deep)' }}
                >
                  {counts[b.key]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '0.72rem', opacity: 0.8 }}>
        <span>Hard to find</span>
        <span>Ready for AI buyers</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
        <FilterChip label={`All ${total}`} color="rgba(255,255,255,0.75)" active={active === 'all'} onClick={() => onPick('all')} />
        {BANDS.map((b) => (
          <FilterChip
            key={b.key}
            label={`${b.label} ${counts[b.key]}`}
            color={b.color}
            active={active === b.key}
            disabled={counts[b.key] === 0}
            onClick={() => onPick(b.key)}
          />
        ))}
      </div>
    </Card>
  );
}

function FilterChip({ label, color, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press-on-active"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 13px',
        borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.28)'}`,
        background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
        color: '#fff',
        fontSize: 'var(--text-xs)',
        fontWeight: active ? 700 : 500,
        fontFamily: 'var(--font-body)',
        opacity: disabled ? 0.4 : 1
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </button>
  );
}

function MetaItem({ label, value, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '1px' }}>
        {label}
      </div>
      <div className="gauge-number" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: color || '#fff' }}>
        {value}
      </div>
    </div>
  );
}

function ProductRow({ product, onAsk }) {
  const band = bandFor(product.score);
  return (
    <Card variant="soft" dense className="row-hover" style={{ padding: 0 }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px' }}>
        <ProductThumb src={product.image} name={product.name} size={52} radius={6} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--text-sm)', lineHeight: 1.3, display: 'block' }}>{product.name}</strong>
          <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', opacity: 0.78 }} className="gauge-number">
            {product.product_id}
          </p>
        </div>

        {/* Opaque backing: band color on glass fails contrast here */}
        <div
          style={{
            flexShrink: 0,
            textAlign: 'center',
            background: 'var(--color-navy-deep)',
            border: `1px solid ${band.color}`,
            borderRadius: 'var(--radius-sm)',
            padding: '7px 12px',
            minWidth: 74
          }}
        >
          <div className="gauge-number" style={{ fontWeight: 800, fontSize: '1.5rem', color: band.color, lineHeight: 1 }}>
            {product.score === null ? '--' : product.score}
          </div>
          <div
            style={{
              fontSize: '0.66rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: band.color,
              marginTop: '4px'
            }}
          >
            {band.label}
          </div>
        </div>
      </div>

      {product.score !== null && (
        <div style={{ height: 7, background: 'rgba(255,255,255,0.14)' }}>
          <div style={{ width: `${product.score}%`, height: '100%', background: band.color }} />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          padding: '11px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.10)'
        }}
      >
        <MetaItem label="Price" value={product.price != null ? `₹${product.price}` : '--'} />
        <MetaItem label="Stock" value={product.stock ?? '--'} color={product.stock === 0 ? 'var(--color-danger)' : undefined} />
        <MetaItem label="Brand" value={product.brand || '--'} />
        <MetaItem label="Category" value={product.category || '--'} />
      </div>

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
          <SparkleIcon size={13} />
          <span style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>
            How AI reads this listing
          </span>
        </div>

        {product.description && (
          <p
            style={{
              margin: '0 0 10px',
              padding: '8px 11px',
              borderLeft: '2px solid rgba(255,255,255,0.3)',
              background: 'rgba(0,0,0,0.16)',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.5,
              opacity: 0.75,
              fontStyle: 'italic'
            }}
          >
            {product.description}
          </p>
        )}

        <p style={{ margin: 0, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{product.verdict}</p>

        {product.issues.length > 0 && (
          <ul style={{ margin: '9px 0 0', paddingLeft: '15px', fontSize: 'var(--text-xs)', opacity: 0.75, lineHeight: 1.6 }}>
            {product.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}

        <button type="button" onClick={() => onAsk(product)} className="ask-btn press-on-active" style={{ marginTop: '13px' }}>
          <ChatIcon size={13} />
          Ask about this listing
        </button>
      </div>
    </Card>
  );
}

const GRADING_POLL_MS = 4000;

export default function CatalogPage() {
  const { merchantId } = useMerchant();
  const navigate = useNavigate();
  const [products, setProducts] = useState(null);
  const [gradingPending, setGradingPending] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!merchantId) return;
    setProducts(null);
    setGradingPending(false);
    setError(null);

    let cancelled = false;
    let timer = null;

    function load() {
      getReadiness(merchantId)
        .then(({ products: fetched, pending }) => {
          if (cancelled) return;
          setProducts(fetched);
          setGradingPending(pending);
          if (pending) timer = setTimeout(load, GRADING_POLL_MS);
        })
        .catch((err) => !cancelled && setError(err.message));
    }
    load();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [merchantId]);

  const counts = useMemo(() => {
    if (!products) return null;
    return BANDS.reduce((acc, b) => ({ ...acc, [b.key]: products.filter((p) => b.test(p.score)).length }), {});
  }, [products]);

  const visible = useMemo(() => {
    if (!products) return [];
    if (filter === 'all') return products;
    const band = BANDS.find((b) => b.key === filter);
    return products.filter((p) => band.test(p.score));
  }, [products, filter]);

  // Attaches listing as record; merchant writes own question.
  function askAboutProduct(product) {
    navigate('/chat', {
      state: {
        attachment: {
          kind: 'product',
          image: product.image,
          title: product.name,
          subtitle: `${product.product_id} · ${product.score === null ? 'not graded' : `${product.score}/100`}`,
          context: `About my listing "${product.name}" (product_id ${product.product_id}), currently scored ${
            product.score === null ? 'ungraded' : product.score
          } for AI findability.`
        }
      }
    });
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720 }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Findability audit</span>
          <h1 className="page-title">Catalog readiness</h1>
          <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', opacity: 0.9, maxWidth: 560 }}>
            Every listing, scored on whether an AI shopping agent's search could actually surface it. Worst first.
          </p>
        </header>

        {error && (
          <Alert variant="destructive" title="Couldn't grade your catalog">
            {error}
          </Alert>
        )}

        {!error && products === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 190, borderRadius: 'var(--radius-row)' }} />
              ))}
            </div>
          </div>
        )}

        {!error && products && products.length > 0 && (
          <>
            {gradingPending && (
              <Alert title="Refining scores in the background" style={{ marginBottom: 'var(--space-3)' }}>
                Missing price/image/description issues below are already final. AI description grading is still running
                and will fill in the rest of the scores shortly -- no need to reload.
              </Alert>
            )}

            <DistributionBar counts={counts} total={products.length} active={filter} onPick={setFilter} />

            {!gradingPending && counts.ungraded === products.length && (
              <Alert title="Nothing was graded on this pass" style={{ marginBottom: 'var(--space-3)' }}>
                The description reader couldn't run, so these listings have no score yet -- they are not confirmed healthy.
                Reload in a minute to try again.
              </Alert>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {visible.map((p) => (
                <ProductRow key={p.product_id} product={p} onAsk={askAboutProduct} />
              ))}
            </div>
          </>
        )}

        {!error && products && products.length === 0 && (
          <Card variant="soft" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            No products in this catalog yet.
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
