import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMerchantIds } from '../api/merchant';
import { useMerchant } from '../context/MerchantContext';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';

// Real merchant_id values already in products table, no auth.
export default function PickerPage() {
  const [merchantIds, setMerchantIds] = useState(null);
  const [error, setError] = useState(null);
  const { setMerchantId } = useMerchant();
  const navigate = useNavigate();

  useEffect(() => {
    listMerchantIds()
      .then(setMerchantIds)
      .catch((err) => setError(err.message));
  }, []);

  function pick(id) {
    setMerchantId(id);
    navigate('/home');
  }

  return (
    <div
      className="merchant-bg"
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        gap: 'var(--space-4)'
      }}
    >
      <div style={{ background: 'rgb(210, 228, 248)', borderRadius: 'var(--radius-lg)', padding: '10px 22px' }}>
        <img src="/payzorray-logo.png" alt="Payzorray" style={{ height: 72, width: 'auto', display: 'block' }} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <h1 className="brand-heading" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-1)' }}>
          Choose your store
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', opacity: 0.85 }}>
          Pick the store you manage to see its real revenue, orders, and catalog health.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" title="Couldn't load stores" style={{ maxWidth: 440 }}>
          {error}
        </Alert>
      )}

      {!error && merchantIds === null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', maxWidth: 440 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} style={{ height: 60, borderRadius: 20 }} />
          ))}
        </div>
      )}

      {!error && merchantIds !== null && merchantIds.length === 0 && (
        <Card variant="loud" style={{ maxWidth: 440, textAlign: 'center' }}>
          No stores found yet.
        </Card>
      )}

      {merchantIds && merchantIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', maxWidth: 440 }}>
          {merchantIds.map((id) => (
            <button
              key={id}
              onClick={() => pick(id)}
              className="press-on-active"
              style={{ all: 'unset', display: 'block', cursor: 'pointer' }}
            >
              <Card
                variant="soft"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)'
                }}
              >
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{id}</span>
                <span style={{ color: 'var(--color-accent)', fontSize: 'var(--text-lg)' }}>&rarr;</span>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
