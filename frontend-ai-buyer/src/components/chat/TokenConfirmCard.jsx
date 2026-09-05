import { LightCard, MetaField, Panel, LightButton, RECEIPT } from './LightCard';
import { LockIcon } from '../ui/icons';

function optionButtonStyle({ primary, disabled }) {
  return {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    padding: '11px 14px',
    borderRadius: 'var(--radius)',
    border: primary ? 'none' : `1.5px solid ${RECEIPT.panelBorder}`,
    background: primary ? 'var(--color-blue)' : '#ffffff',
    color: primary ? '#ffffff' : disabled ? RECEIPT.textMuted : RECEIPT.text,
    opacity: disabled ? 0.55 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left'
  };
}

export default function TokenConfirmCard({ amount, currency, productName, walletAvailable, walletReason, walletStatus, checkoutStatus, onConfirmWallet, onConfirmCheckout, onCancel }) {
  const walletBusy = walletStatus === 'processing';
  const checkoutBusy = checkoutStatus === 'opening' || checkoutStatus === 'processing';
  const anyBusy = walletBusy || checkoutBusy;
  const errorText = walletStatus === 'error' ? "UPI Reserve Pay didn't go through." : checkoutStatus === 'error' ? "That payment didn't go through." : null;

  return (
    <div style={{ padding: '2px var(--space-2) var(--space-2)' }}>
      <LightCard
        title="Confirm Payment"
        maxWidth="360px"
        footer={
          <button
            type="button"
            onClick={onCancel}
            disabled={anyBusy}
            style={{ display: 'block', margin: '0 auto', background: 'none', border: 'none', color: RECEIPT.textMuted, fontSize: 'var(--text-xs)', fontWeight: 700, cursor: anyBusy ? 'not-allowed' : 'pointer', textDecoration: 'underline' }}
          >
            Cancel
          </button>
        }
      >
        <dl style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '16px' }}>
          <MetaField label="Item" value={productName} />
          <MetaField label="Amount" value={`${currency === 'INR' ? '₹' : `${currency} `}${amount}`} />
        </dl>

        {errorText && (
          <p style={{ color: '#c73737', fontWeight: 700, fontSize: 'var(--text-xs)', marginBottom: '14px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(214,69,69,0.08)', border: '1px solid rgba(214,69,69,0.25)' }}>
            {errorText}
          </p>
        )}

        <Panel title="Payment Method">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button type="button" disabled={!walletAvailable || anyBusy} onClick={onConfirmWallet} style={optionButtonStyle({ primary: walletAvailable, disabled: !walletAvailable })}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{walletBusy ? 'Confirming…' : 'UPI Reserve Pay'}</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{walletAvailable ? 'Pay instantly from your wallet' : walletReason}</span>
            </button>

            <button type="button" disabled={anyBusy} onClick={onConfirmCheckout} style={optionButtonStyle({ primary: false, disabled: false })}>
              <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{checkoutStatus === 'opening' ? 'Opening Razorpay…' : checkoutStatus === 'processing' ? 'Confirming…' : 'Pay another way'}</span>
              <span style={{ fontSize: '0.7rem', color: RECEIPT.textMuted }}>Card · UPI · Netbanking via Razorpay</span>
            </button>
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LockIcon size={11} style={{ color: RECEIPT.textMuted, flexShrink: 0 }} />
            <p style={{ fontSize: '0.66rem', color: RECEIPT.textMuted, textAlign: 'center' }}>
              Nothing charges until you confirm here
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85 }}>
            <span style={{ fontSize: '0.64rem', color: RECEIPT.textMuted }}>Payments powered by</span>
            <img src="/razorpay-logo.png" alt="Razorpay" style={{ height: '13px', width: 'auto', display: 'block' }} />
          </div>
        </div>
      </LightCard>
    </div>
  );
}
