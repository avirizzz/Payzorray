import ProductImage from '../ui/ProductImage';
import { LightCard, RECEIPT } from './LightCard';

// Winners are computed here in code, not by the model.
const ROWS = [
  { key: 'price', label: 'Price', format: (v) => `₹${v}`, lowerIsBetter: true },
  { key: 'brand', label: 'Brand' },
  { key: 'category', label: 'Category' },
  { key: 'stock', label: 'In stock', format: (v, p) => (p.in_stock ? `${v} available` : 'Out of stock'), higherIsBetter: true }
];

function winnerIndex(products, row) {
  if (!row.lowerIsBetter && !row.higherIsBetter) return null;
  const values = products.map((p) => Number(p[row.key]));
  if (values.some((v) => Number.isNaN(v))) return null;
  const best = row.lowerIsBetter ? Math.min(...values) : Math.max(...values);
  // Not a real winner if it's a tie.
  if (values.every((v) => v === best)) return null;
  return values.indexOf(best);
}

export default function CompareCard({ data }) {
  const { products, insight } = data || {};
  if (!products?.length) return null;

  const cols = `120px repeat(${products.length}, 1fr)`;

  return (
    <div style={{ paddingLeft: '40px' }}>
      <LightCard title="Comparison" badge={`${products.length} products`} maxWidth={products.length > 2 ? '620px' : '460px'}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: products.length > 2 ? '560px' : 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '10px', marginBottom: '10px' }}>
              <div />
              {products.map((p) => (
                <div key={p.product_id} style={{ minWidth: 0 }}>
                  <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: RECEIPT.thumbBg, marginBottom: '6px' }}>
                    <ProductImage src={p.image} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <p
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: RECEIPT.text,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {p.name}
                  </p>
                </div>
              ))}
            </div>

            {ROWS.map((row) => {
              const winner = winnerIndex(products, row);
              return (
                <div
                  key={row.key}
                  style={{ display: 'grid', gridTemplateColumns: cols, gap: '10px', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${RECEIPT.divider}` }}
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: RECEIPT.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{row.label}</span>
                  {products.map((p, i) => {
                    const raw = p[row.key];
                    const value = row.format ? row.format(raw, p) : raw ?? '—';
                    const isWinner = winner === i;
                    return (
                      <span
                        key={p.product_id}
                        className={row.key === 'price' || row.key === 'stock' ? 'gauge-number' : undefined}
                        style={{ fontSize: 'var(--text-sm)', fontWeight: isWinner ? 800 : 600, color: isWinner ? '#1a8a5f' : RECEIPT.text }}
                      >
                        {value}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {insight && (
          <div style={{ marginTop: '14px', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: 'var(--radius)', padding: '12px 13px' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-blue)', marginBottom: '6px' }}>AI take</p>
            <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.text, lineHeight: 1.55 }}>{insight}</p>
          </div>
        )}
      </LightCard>
    </div>
  );
}
