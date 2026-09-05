import { useState } from 'react';
import { CheckIcon, DownloadIcon, ChartIcon, GlobeIcon, ExternalLinkIcon, CopyIcon, ThumbsUpIcon, ThumbsDownIcon, PencilIcon } from '../ui/icons';
import { getInvoiceUrl } from '../../api/client';
import { setMessageFeedback } from '../../api/feedback';
import StreamingText from './StreamingText';
import ShoppingListReview from './ShoppingListReview';
import CartInlineCard from './CartInlineCard';
import UpsellOfferCard from './UpsellOfferCard';
import CancelOrderCard from './CancelOrderCard';
import OrderActivityCard from './OrderActivityCard';
import CompareCard from './CompareCard';
import { LightCard, RECEIPT, LightButton } from './LightCard';

function Avatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        background: 'var(--gradient-accent)',
        color: '#fff',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontSize: '0.7rem',
        fontWeight: 700
      }}
    >
      AI
    </div>
  );
}

function bubbleStyle(isUser) {
  return isUser
    ? {
        width: 'fit-content',
        maxWidth: '75%',
        padding: '12px 20px',
        borderRadius: 'var(--radius-lg)',
        borderTopRightRadius: '4px',
        background: '#ffffff',
        border: 'none',
        boxShadow: '0 6px 18px rgba(1,15,40,0.22)',
        color: 'var(--color-blue)',
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere'
      }
    : {
        maxWidth: '78%',
        padding: '14px 18px',
        borderRadius: 'var(--radius-lg)',
        borderTopLeftRadius: '4px',
        background: 'var(--color-blue)',
        border: 'none',
        boxShadow: '0 6px 18px rgba(1,15,40,0.22)',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: 'var(--text-sm)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap'
      };
}

// Every past step keeps its own Change link.
function OptionsRecap({ prompt, options, selectedId, canChange, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Avatar />
      <LightCard
        title={prompt}
        maxWidth="360px"
        footer={
          canChange ? (
            <LightButton variant="ghost" style={{ width: '100%' }} onClick={onChange}>
              Change
            </LightButton>
          ) : undefined
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {options.map((opt) => {
            const chosen = opt.id === selectedId;
            return (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: 'var(--text-sm)',
                  padding: '8px 11px',
                  borderRadius: 'var(--radius)',
                  fontWeight: chosen ? 700 : 500,
                  background: chosen ? 'rgba(13,148,251,0.1)' : 'transparent',
                  border: `1px solid ${chosen ? 'rgba(13,148,251,0.3)' : 'transparent'}`,
                  color: chosen ? RECEIPT.text : RECEIPT.textMuted
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  {chosen && <CheckIcon size={12} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                </span>
                {opt.sublabel && (
                  <span className="gauge-number" style={{ flexShrink: 0, fontSize: '0.76rem', fontWeight: 700, color: chosen ? 'var(--color-blue)' : RECEIPT.textMuted }}>
                    {opt.sublabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </LightCard>
    </div>
  );
}

// done means not the current last step, not truly finished.
function TraceLine({ text, done }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <div style={{ width: '30px', display: 'flex', justifyContent: 'center' }}>
        {done ? (
          <span
            style={{ width: '15px', height: '15px', borderRadius: '50%', background: 'rgba(47,214,143,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <CheckIcon size={8} style={{ color: 'var(--color-success)' }} />
          </span>
        ) : (
          <span
            style={{
              width: '14px',
              height: '14px',
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: 'var(--color-blue)',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'trace-spin 0.8s linear infinite'
            }}
          />
        )}
      </div>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{text}</span>
      <style>{'@keyframes trace-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

// Invoice PDF is generated fresh per click, not stored.
function OrderHistoryList({ orders, total, customerId }) {
  const truncated = total != null && total > orders.length;
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Avatar />
      <LightCard title="Order History" badge={truncated ? `${orders.length} of ${total}` : `${orders.length} order${orders.length === 1 ? '' : 's'}`} maxWidth="380px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orders.length === 0 && <p style={{ fontSize: 'var(--text-sm)', color: RECEIPT.textMuted }}>No orders yet.</p>}
          {orders.map((o) => (
            <div key={o.order_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius)', background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}` }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.product_name || o.product_id}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: RECEIPT.textMuted }}>
                  ₹{o.amount} · {o.status === 'COMPLETED' ? o.tracking_stage || 'Confirmed' : o.status.replace(/_/g, ' ').toLowerCase()} · {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              {o.status === 'COMPLETED' && customerId && (
                <a
                  href={getInvoiceUrl(o.order_id, customerId)}
                  target="_blank"
                  rel="noreferrer"
                  className="press-on-active"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-blue)', color: '#ffffff', fontSize: 'var(--text-xs)', fontWeight: 700, textDecoration: 'none' }}
                >
                  <DownloadIcon size={12} />
                  Invoice
                </a>
              )}
            </div>
          ))}
        </div>
      </LightCard>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', padding: '4px 0' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="gauge-number" style={{ fontWeight: 700 }}>₹{value}</span>
    </div>
  );
}

function BreakdownBars({ title, rows, keyName }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div style={{ marginTop: '10px' }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '6px' }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.slice(0, 5).map((r) => (
          <div key={r[keyName]}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: '2px' }}>
              <span>{r[keyName]}</span>
              <span className="gauge-number">₹{r.total}</span>
            </div>
            <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(6, (r.total / max) * 100)}%`, background: 'var(--gradient-accent)', borderRadius: '3px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpendingStatsPanel({ stats }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Avatar />
      <div className="glass-strong" style={{ maxWidth: '90%', width: '320px', borderRadius: 'var(--radius-lg)', borderTopLeftRadius: '6px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <ChartIcon size={14} style={{ color: 'var(--color-blue)' }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-blue)' }}>Spending</span>
        </div>
        <StatRow label="Total spend" value={stats.total_spend} />
        <StatRow label="Last 7 days" value={stats.last_7_days} />
        <StatRow label="Last 30 days" value={stats.last_30_days} />
        <BreakdownBars title="By category" rows={stats.by_category} keyName="category" />
        <BreakdownBars title="By brand" rows={stats.by_brand} keyName="brand" />
      </div>
    </div>
  );
}

// Web results are browse-only: no preview, no checkout option.
function WebResultList({ results }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <Avatar />
      <div style={{ maxWidth: '90%', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', paddingLeft: '2px' }}>
          <GlobeIcon size={12} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Found on the web</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
          {results.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="glass"
              style={{
                position: 'relative',
                width: '150px',
                flexShrink: 0,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '3 / 4', background: 'rgba(255,255,255,0.05)' }}>
                {r.image ? (
                  <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GlobeIcon size={22} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                )}
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '6px',
                    padding: '3px 7px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(1,15,40,0.75)',
                    backdropFilter: 'blur(6px)',
                    color: 'var(--color-danger)',
                    fontSize: '0.58rem',
                    fontWeight: 700
                  }}
                >
                  Not for checkout
                </span>
              </div>
              <div style={{ padding: '8px 10px 10px', background: 'var(--glass-bg-strong)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.68rem', lineHeight: 1.3, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{r.title}</p>
                  <ExternalLinkIcon size={9} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                </div>
                {r.source && <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-blue)', marginTop: '3px' }}>{r.source}</p>}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShoppingListSentCard({ items, isActive, onEdit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <LightCard
        title="Shopping List"
        badge={`${items.length} item${items.length > 1 ? 's' : ''}`}
        maxWidth="340px"
        footer={
          isActive && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="press-on-active"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', background: 'none', border: 'none', color: 'var(--color-blue)', fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer' }}
            >
              <PencilIcon size={11} />
              Edit list
            </button>
          ) : undefined
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <span
                aria-hidden="true"
                className="gauge-number"
                style={{ width: '22px', height: '22px', flexShrink: 0, borderRadius: '50%', border: `1px solid ${RECEIPT.panelBorder}`, background: 'rgba(13,148,251,0.12)', color: 'var(--color-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700 }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: RECEIPT.text }}>
                {item.quantity > 1 ? `${item.quantity}× ` : ''}
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </LightCard>
    </div>
  );
}

// Solid fill (not tinted icon) stays visible on gradient bg.
function iconButtonStyle(active, activeColor) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: active ? activeColor : 'transparent',
    color: '#ffffff',
    opacity: active ? 1 : 0.85,
    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
    cursor: 'pointer'
  };
}

// Votes steer the system prompt in-context; no model retraining.
function FeedbackRow({ message, customerId, messageFeedback }) {
  const [vote, setVote] = useState(() => messageFeedback?.get(message) ?? null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard failures are silent by design; no crash needed.
    }
  };

  const handleVote = async (next) => {
    if (!customerId || busy) return;
    const resolved = vote === next ? null : next;
    setVote(resolved);
    messageFeedback?.set(message, resolved);
    setBusy(true);
    try {
      const result = await setMessageFeedback({ customerId, messageText: message.text, vote: next });
      setVote(result.vote);
      messageFeedback?.set(message, result.vote);
    } catch {
      setVote(vote);
      messageFeedback?.set(message, vote);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button type="button" className="icon-btn press-on-active" onClick={handleCopy} aria-label="Copy reply" style={iconButtonStyle(false)}>
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={15} />}
      </button>
      <button type="button" className="icon-btn press-on-active" onClick={() => handleVote('up')} aria-label="Good reply" aria-pressed={vote === 'up'} style={iconButtonStyle(vote === 'up', 'var(--color-blue)')}>
        <ThumbsUpIcon size={15} />
      </button>
      <button type="button" className="icon-btn press-on-active" onClick={() => handleVote('down')} aria-label="Bad reply" aria-pressed={vote === 'down'} style={iconButtonStyle(vote === 'down', 'var(--color-danger)')}>
        <ThumbsDownIcon size={15} />
      </button>
    </div>
  );
}

export default function MessageBubble({
  message,
  canChange,
  onChange,
  customerId,
  streamedMessages,
  messageFeedback,
  onConfirmShoppingList,
  onRemoveFromCart,
  onCartQtyChange,
  onCartCheckout,
  onRespondToUpsell,
  onEditShoppingList,
  shoppingListDraft,
  productScores,
  onPreviewOption,
  onConfirmCancellation,
  onDismissCancellation,
  isLast,
  isThinking
}) {
  if (message.kind === 'options') {
    return <OptionsRecap prompt={message.prompt} options={message.options} selectedId={message.selectedId} canChange={canChange} onChange={onChange} />;
  }
  if (message.kind === 'trace') {
    return <TraceLine text={message.text} done={!(isLast && isThinking)} />;
  }
  if (message.kind === 'orders') {
    return <OrderHistoryList orders={message.orders} total={message.total} customerId={customerId} />;
  }
  if (message.kind === 'stats') {
    return <SpendingStatsPanel stats={message.stats} />;
  }
  if (message.kind === 'web-results') {
    return <WebResultList results={message.results} />;
  }
  if (message.kind === 'shopping-list') {
    return <ShoppingListReview data={message.data} onConfirm={onConfirmShoppingList} scores={productScores} onPreview={onPreviewOption} />;
  }
  if (message.kind === 'shopping-list-sent') {
    return <ShoppingListSentCard items={message.items} isActive={message.items === shoppingListDraft} onEdit={onEditShoppingList} />;
  }
  if (message.kind === 'upsell') {
    return (
      <UpsellOfferCard
        offer={message.offer}
        resolved={message.resolved}
        onAccept={() => onRespondToUpsell?.(message.offer, true)}
        onSkip={() => onRespondToUpsell?.(message.offer, false)}
      />
    );
  }

  if (message.kind === 'order-activity') {
    return <OrderActivityCard activity={message.activity} />;
  }
  if (message.kind === 'cancel-order') {
    return (
      <CancelOrderCard
        proposal={message.proposal}
        onConfirm={onConfirmCancellation}
        onDismiss={() => onDismissCancellation?.(message.proposal.order_id)}
      />
    );
  }

  if (message.kind === 'compare') {
    return <CompareCard data={message.data} />;
  }

  if (message.kind === 'cart') {
    return <CartInlineCard cart={message.cart} onRemove={onRemoveFromCart} onQtyChange={onCartQtyChange} onCheckout={onCartCheckout} />;
  }

  const isUser = message.role === 'user';
  const [done, setDone] = useState(() => (isUser ? true : (streamedMessages?.has(message) ?? false)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
        {!isUser && <Avatar />}
        <div style={bubbleStyle(isUser)}>
          {isUser ? message.text : <StreamingText text={message.text} message={message} streamed={streamedMessages} onDone={() => setDone(true)} />}
        </div>
      </div>
      {!isUser && done && (
        <div style={{ paddingLeft: '40px' }}>
          <FeedbackRow message={message} customerId={customerId} messageFeedback={messageFeedback} />
        </div>
      )}
    </div>
  );
}
