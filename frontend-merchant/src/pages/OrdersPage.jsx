import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { getRecentOrders } from '../api/merchant';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import Alert from '../components/ui/Alert';
import ProductThumb from '../components/ui/ProductThumb';
import { ChatIcon } from '../components/ui/icons';

// COMPLETED gets no color; color here means something went wrong.
const EXCEPTION_STATUS = {
  PAYMENT_FAILED: { label: 'Payment failed', color: 'var(--color-danger)' },
  REFUNDED: { label: 'Refunded', color: 'var(--color-danger)' },
  CANCELLED: { label: 'Cancelled', color: 'rgba(255,255,255,0.55)' },
  PAYMENT_PENDING: { label: 'Pending', color: 'rgba(255, 200, 87, 0.95)' }
};

function money(amount, currency) {
  return `${currency === 'INR' ? '₹' : ''}${Number(amount).toLocaleString('en-IN')}`;
}

function OrderRow({ order, onAsk }) {
  const exception = EXCEPTION_STATUS[order.status];
  return (
    <Card variant="soft" dense className="row-hover" style={{ padding: 'var(--space-2)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <ProductThumb src={order.image} name={order.product_name} size={56} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'baseline' }}>
            <strong style={{ fontSize: 'var(--text-sm)', lineHeight: 1.35 }}>{order.product_name}</strong>
            <span className="gauge-number" style={{ fontWeight: 800, fontSize: 'var(--text-md)', whiteSpace: 'nowrap' }}>
              {money(order.amount, order.currency)}
            </span>
          </div>

          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', opacity: 0.82 }}>
            {[order.brand, order.category].filter(Boolean).join(' · ')}
          </p>

          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.28)', margin: '10px 0 8px' }} />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px var(--space-2)',
              alignItems: 'center',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              opacity: 0.85
            }}
          >
            <span className="gauge-number">{order.order_id.replace(/^ORD_/, '')}</span>
            <span>Qty {order.quantity}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              {exception && (
                <span style={{ color: exception.color, fontWeight: 700 }}>{exception.label}</span>
              )}
              <span className="gauge-number">
                {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </span>
          </div>

          <button type="button" onClick={() => onAsk(order)} className="ask-btn press-on-active" style={{ marginTop: '12px' }}>
            <ChatIcon size={13} />
            Ask about this order
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function OrdersPage() {
  const { merchantId } = useMerchant();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!merchantId) return;
    setOrders(null);
    setError(null);
    getRecentOrders(merchantId).then(setOrders).catch((err) => setError(err.message));
  }, [merchantId]);

  const summary = useMemo(() => {
    if (!orders) return null;
    const paid = orders.filter((o) => o.status === 'COMPLETED');
    const flagged = orders.filter((o) => EXCEPTION_STATUS[o.status]);
    return {
      revenue: paid.reduce((sum, o) => sum + Number(o.amount || 0), 0),
      paid: paid.length,
      flagged: flagged.length
    };
  }, [orders]);

  // Same hand-off pattern as Catalog page's ask-about flow.
  function askAboutOrder(order) {
    navigate('/chat', {
      state: {
        attachment: {
          kind: 'order',
          image: order.image,
          title: order.product_name,
          subtitle: `${order.order_id.replace(/^ORD_/, '')} · ${money(order.amount, order.currency)} · ${order.status}`,
          context: `About order ${order.order_id} for "${order.product_name}" (product_id ${order.product_id}), ${money(
            order.amount,
            order.currency
          )}, quantity ${order.quantity}, status ${order.status}, placed ${new Date(order.created_at).toLocaleDateString('en-IN')}.`
        }
      }
    });
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720 }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Most recent 20</span>
          <h1 className="page-title">Orders</h1>
          {summary && (
            <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', opacity: 0.9 }}>
              <strong className="gauge-number">{money(summary.revenue, 'INR')}</strong> from {summary.paid} paid
              {summary.flagged > 0 && <> · <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{summary.flagged} need a look</span></>}
            </p>
          )}
        </header>

        {error && (
          <Alert variant="destructive" title="Couldn't load orders">
            {error}
          </Alert>
        )}

        {!error && orders === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} style={{ height: 118, borderRadius: 'var(--radius-row)' }} />
            ))}
          </div>
        )}

        {!error && orders && orders.length === 0 && (
          <Card variant="soft" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
            No orders yet. They'll appear here the moment an AI buyer completes a checkout.
          </Card>
        )}

        {!error && orders && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {orders.map((order) => (
              <OrderRow key={order.order_id} order={order} onAsk={askAboutOrder} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
