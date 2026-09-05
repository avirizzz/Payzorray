import { useState } from 'react';
import { LightCard, LightButton, ItemRow, RECEIPT } from './LightCard';
import { SparkleIcon } from '../ui/icons';

// Price matches checkout: same discount re-derived from campaign row.
export default function UpsellOfferCard({ offer, onAccept, onSkip, resolved }) {
  const [busy, setBusy] = useState(false);
  const discounted = offer.discount > 0;

  if (resolved) {
    return (
      <div style={{ width: '100%', maxWidth: '440px', padding: '12px 16px', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: '#fff', opacity: 0.85 }}>
          {resolved === 'accepted' ? `Added ${offer.product.name} to your cart.` : 'No problem — skipped.'}
        </p>
      </div>
    );
  }

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <LightCard
      title="Goes well with this"
      badge={discounted ? `Save ₹${offer.discount}` : 'Suggested'}
      maxWidth="440px"
      footer={
        <div style={{ display: 'flex', gap: '10px' }}>
          <LightButton onClick={() => run(onAccept)} disabled={busy} style={{ flex: 1 }}>
            {busy ? 'Adding…' : discounted ? `Add for ₹${offer.final_price}` : `Add for ₹${offer.list_price}`}
          </LightButton>
          <LightButton variant="ghost" onClick={() => run(onSkip)} disabled={busy}>
            No thanks
          </LightButton>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ color: 'var(--color-blue)', flexShrink: 0, marginTop: '1px' }}>
          <SparkleIcon size={14} />
        </span>
        <p style={{ fontSize: 'var(--text-sm)', color: RECEIPT.text, lineHeight: 1.5 }}>{offer.pitch}</p>
      </div>

      <ItemRow
        first
        src={offer.product.images?.[0]}
        alt={offer.product.name}
        name={offer.product.name}
        meta={offer.product.category}
        price={
          discounted ? (
            <span>
              <span style={{ textDecoration: 'line-through', color: RECEIPT.textMuted, fontWeight: 500, marginRight: '6px' }}>
                ₹{offer.list_price}
              </span>
              ₹{offer.final_price}
            </span>
          ) : (
            `₹${offer.list_price}`
          )
        }
      />

      <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginTop: '10px' }}>
        {discounted
          ? "This discount comes from the seller and is applied when you pay -- it doesn't change what you're already buying."
          : 'Adding this is optional and changes nothing about your current items.'}
      </p>
    </LightCard>
  );
}
