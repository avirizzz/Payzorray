import { useEffect, useState } from 'react';
import { getProfile, AI_BUYER_PERSONA_ID } from '../api/profile';
import { listOrders, cancelOrder } from '../api/commerce';
import { getInvoiceUrl } from '../api/client';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { DownloadIcon } from '../components/ui/icons';

const STATUS_COLOR = {
  COMPLETED: 'rgba(13,148,251,0.14)',
  PAYMENT_PENDING: 'var(--color-surface-raised)',
  PAYMENT_FAILED: 'rgba(214,69,69,0.14)',
  CANCELLED: 'var(--color-surface-raised)',
  REFUNDED: 'rgba(47,214,143,0.14)'
};

// Same action becomes a refund once shipped, not a cancel.
function isPreShip(stage) {
  return stage === 'CONFIRMED' || stage === 'PACKED';
}

function OrderCard({ order, customerId, onCancelled }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const isCompleted = order.status === 'COMPLETED';
  const stage = order.tracking_stage || 'CONFIRMED';
  const preShip = isPreShip(stage);

  async function handleCancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cancelOrder({ orderId: order.order_id, customerId });
      if (result.status === 'CANCELLED' || result.status === 'REFUNDED') {
        onCancelled(order.order_id, result.status);
      } else {
        setError(result.reason || "Couldn't process that right now — nothing was changed.");
        setConfirming(false);
      }
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
        <div>
          <strong>{order.product_name || order.product_id}</strong>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            {order.order_id} · {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <Badge color={STATUS_COLOR[order.status] || 'var(--color-surface-raised)'}>{order.status}</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--text-sm)', marginBottom: '6px' }}>
        {order.shipping_option && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            Shipping: {order.shipping_option} (₹{order.shipping_cost})
          </span>
        )}
        {order.coupon_code && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            Coupon {order.coupon_code}: -₹{order.discount_amount}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {isCompleted ? stage.charAt(0) + stage.slice(1).toLowerCase() : order.status.replace(/_/g, ' ').toLowerCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {order.status === 'COMPLETED' && customerId && (
            <a
              href={getInvoiceUrl(order.order_id, customerId)}
              target="_blank"
              rel="noreferrer"
              className="press-on-active"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-blue)', fontSize: 'var(--text-xs)', fontWeight: 700, textDecoration: 'none' }}
            >
              <DownloadIcon size={11} />
              Invoice
            </a>
          )}
          <span className="gauge-number" style={{ fontWeight: 700, color: 'var(--color-blue)' }}>
            ₹{order.amount}
          </span>
        </div>
      </div>

      {isCompleted && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--color-border)' }}>
          {!confirming ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="press-on-active"
                style={{
                  background: 'transparent',
                  border: '1.5px solid rgba(214,69,69,0.5)',
                  borderRadius: 'var(--radius)',
                  padding: '7px 14px',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel order
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.55, marginBottom: '10px' }}>
                {preShip
                  ? `This order is still at ${stage.toLowerCase()}, so it can be stopped. ₹${order.amount} goes back to ${order.simulated_payment ? 'your spending limit' : 'your card'}.`
                  : `This order already reached ${stage.toLowerCase()}, so it can't be stopped — cancelling now is processed as a refund of ₹${order.amount} back to ${order.simulated_payment ? 'your spending limit' : 'your card'}.`}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="press-on-active"
                  style={{ background: 'transparent', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '7px 14px', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="press-on-active"
                  style={{ background: 'var(--color-danger)', border: 'none', borderRadius: 'var(--radius)', padding: '7px 14px', color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? 'Processing…' : preShip ? 'Yes, cancel it' : 'Yes, refund it'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: '6px', textAlign: 'right' }}>{error}</p>}
    </Card>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProfile(AI_BUYER_PERSONA_ID)
      .then((profile) => {
        setCustomerId(profile.customer_id);
        return listOrders(profile.customer_id);
      })
      .then(setOrders)
      .catch((err) => setError(err.message));
  }, []);

  function handleCancelled(orderId, newStatus) {
    setOrders((prev) => prev.map((o) => (o.order_id === orderId ? { ...o, status: newStatus } : o)));
  }

  if (error) return <div style={{ padding: 'var(--space-4)', color: 'var(--color-danger)', fontWeight: 700 }}>Error: {error}</div>;
  if (!orders) return <div style={{ padding: 'var(--space-4)' }}>Loading…</div>;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%', padding: 'var(--space-4)', overflowY: 'auto' }}>
      <p className="eyebrow" style={{ marginBottom: '8px' }}>Purchase history</p>
      <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-3)' }}>Your Orders</h2>
      {orders.length === 0 ? (
        <Card style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No orders yet — ask the assistant to find you something, or try /orders once you have one.</Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {orders.map((order) => (
            <OrderCard key={order.order_id} order={order} customerId={customerId} onCancelled={handleCancelled} />
          ))}
        </div>
      )}
    </div>
  );
}
