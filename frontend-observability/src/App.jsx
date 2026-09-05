import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const AUDIT_LOG_LIMIT = 200;

// get_order_details exists on both surfaces; flash keys use "surface:name".
const BUYER_TOOLS = [
  'search_products',
  'web_search_products',
  'process_shopping_list',
  'find_similar',
  'compare_products',
  'propose_purchase',
  'add_to_cart',
  'get_wallet_status',
  'get_order_history',
  'get_order_details',
  'get_order_activity',
  'propose_cancellation',
  'get_available_coupons',
  'check_coupon',
  'browse_catalog',
  'get_product_details',
  'get_invoice',
  'get_spending_stats',
  'get_profile'
];

const MERCHANT_TOOLS = [
  'get_merchant_stats',
  'get_recent_orders',
  'get_order_details',
  'get_flagged_events',
  'get_low_readiness_products',
  'get_inventory_status',
  'get_upsell_performance',
  'get_campaign_performance',
  'get_sales_analytics',
  'diagnose_business'
];

function formatDuration(ms) {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function formatName(name) {
  return name.replace(/_/g, ' ').toUpperCase();
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
const PAYMENT_METHOD_LABELS = { card: 'card', netbanking: 'net banking', upi: 'upi', wallet: 'wallet', emi: 'emi', paylater: 'pay later' };
function formatPaymentMethod(result) {
  const method = result?.method;
  return PAYMENT_METHOD_LABELS[method] || method || 'unknown';
}
// Test Razorpay account can't auto-debit; wallet rail is real.
function humanizeReason(text) {
  if (!text) return text;
  return text.replace(/\bsimulated\s+/gi, '');
}
function summarize(result) {
  if (!result || typeof result !== 'object') return String(result);
  if (result.error) return result.error;
  if (result.reason && result.eligible === false) return humanizeReason(result.reason);
  if (Array.isArray(result.products)) return `${result.products.length} product(s)`;
  if (Array.isArray(result.orders)) return `${result.orders.length} order(s)`;
  if (Array.isArray(result.results)) return `${result.results.length} result(s)`;
  const str = JSON.stringify(result);
  return str.length > 90 ? `${str.slice(0, 90)}…` : str;
}

function callKind(step) {
  if (!step) return null;
  if (step.name === 'web_search_products') return 'WEB SEARCH API';
  if (step.lane === 'ai' || step.llmSchema) return 'LLM API (generateObject)';
  return 'DB / INTERNAL CALL';
}

const HUES = {
  cyan: { rail: 'rgba(0,229,255,0.22)', dim: 'rgba(0,229,255,0.65)', bright: 'var(--cyan)', glow: 'rgba(0,229,255,0.85)' },
  ai: { rail: 'rgba(192,132,255,0.22)', dim: 'rgba(192,132,255,0.65)', bright: 'var(--ai)', glow: 'rgba(192,132,255,0.85)' }
};

function FlowArrow({ from, to, axis, label, active, hue = 'cyan' }) {
  if (!from || !to) return null;
  const palette = HUES[hue] || HUES.cyan;
  const color = active ? palette.bright : palette.dim;
  let d;
  let labelX;
  let labelY;

  if (axis === 'h') {
    const y1 = from.top + from.height / 2;
    const y2 = to.top + to.height / 2;
    const x1 = from.right;
    const x2 = to.left;
    const midX = x1 + (x2 - x1) / 2;
    d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    labelX = midX;
    labelY = Math.min(y1, y2) - 6;
  } else {
    const x1 = from.left + from.width / 2;
    const x2 = to.left + Math.min(to.width, from.width) / 2;
    const y1 = from.bottom;
    const y2 = to.top;
    const midY = y1 + (y2 - y1) / 2;
    d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    labelX = x1 + 6;
    labelY = midY;
  }

  // Monospace: char-width heuristic avoids a second DOM measure pass.
  const textWidth = label.length * 6.8 + 16;
  const chipX = axis === 'h' ? labelX - textWidth / 2 : labelX - 4;
  const chipAnchor = axis === 'h' ? 'middle' : 'start';
  const markerId = `arrow-${hue}-${active ? 'active' : 'dim'}`;

  return (
    <g style={{ transition: 'opacity 0.3s' }}>
      <path d={d} fill="none" stroke={palette.rail} strokeWidth={2.5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? 3.2 : 2}
        strokeDasharray={active ? '8 5' : 'none'}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        className={active ? 'flow-dash-active' : ''}
        style={{ filter: active ? `drop-shadow(0 0 8px ${palette.glow})` : 'none', transition: 'stroke 0.3s, stroke-width 0.3s' }}
      />
      {active && (
        <circle r={3.4} fill={palette.bright} style={{ filter: `drop-shadow(0 0 6px ${palette.glow})` }}>
          <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
        </circle>
      )}
      <rect x={chipX} y={labelY - 10} width={textWidth} height={16} fill="#05070c" stroke={active ? palette.bright : palette.dim} strokeWidth={active ? 1.4 : 1.1} />
      <text x={labelX} y={labelY + 1} fontSize={9.8} fontFamily="var(--mono)" fontWeight={800} letterSpacing="0.05em" fill={active ? palette.bright : 'rgba(223,243,255,0.85)'} textAnchor={chipAnchor}>
        {label}
      </text>
    </g>
  );
}

function Tag({ children, color }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        color,
        background: `${color}18`,
        border: `1px solid ${color}66`,
        boxShadow: `0 0 8px ${color}33`
      }}
    >
      {children}
    </span>
  );
}

const HudPanel = forwardRef(function HudPanel({ title, right, tone, children, style }, ref) {
  return (
    <div ref={ref} className={`hud-panel ${tone === 'fail' ? 'tone-fail' : tone === 'live' ? 'tone-live' : ''}`} style={style}>
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      {tone === 'live' && <div className="scan-sweep" />}
      <div className="hud-header">
        <span className="hud-title">{title}</span>
        {right}
      </div>
      <div className="hud-body">{children}</div>
    </div>
  );
});

function StepCard({ step }) {
  const [open, setOpen] = useState(false);
  const denied = step.outcome === 'denied';
  const laneColor = step.lane === 'ai' ? 'var(--ai)' : 'var(--code)';

  return (
    <div
      className="flicker-in"
      style={{
        border: `1px solid ${denied ? 'var(--fail)' : 'rgba(255,255,255,0.1)'}`,
        background: denied ? 'var(--fail-bg)' : step.lane === 'ai' ? 'var(--ai-bg)' : 'var(--code-bg)',
        marginBottom: 6
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ width: 6, height: 6, background: laneColor, boxShadow: `0 0 6px ${laneColor}`, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 11.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>
          {formatName(step.name)}
        </span>
        {denied && <Tag color="var(--fail)">Blocked</Tag>}
        {step.amount != null && <span style={{ fontSize: 11, color: 'var(--cyan)' }}>₹{step.amount}</span>}
        {step.durationMs != null && <span style={{ fontSize: 10.5, opacity: 0.5 }}>{formatDuration(step.durationMs)}</span>}
        <span style={{ fontSize: 11, opacity: 0.45 }}>{open ? '−' : '+'}</span>
      </button>
      <div style={{ padding: '0 9px 7px' }}>
        <p style={{ margin: 0, fontSize: 11, color: denied ? 'var(--fail)' : 'var(--text-dim)' }}>{summarize(step.result)}</p>
      </div>
      {open && (
        <div style={{ padding: '0 9px 9px', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 2, paddingTop: 8 }}>
          {step.llmSchema && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ai)' }}>Bounded output schema</p>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-dim)' }}>{step.llmSchema.label}</p>
              <div style={{ background: 'rgba(0,0,0,0.35)', padding: '5px 7px' }}>
                {step.llmSchema.fields.map((f) => (
                  <div key={f.field} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                    <span style={{ fontWeight: 700 }}>{f.field}</span>
                    <span style={{ opacity: 0.55 }}>{f.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.5 }}>Input</p>
          <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.35)', padding: '5px 7px', marginBottom: 7, overflowX: 'auto' }}>{JSON.stringify(step.args ?? {}, null, 1)}</pre>
          <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.5 }}>Output</p>
          <pre style={{ fontSize: 10, background: 'rgba(0,0,0,0.35)', padding: '5px 7px', overflowX: 'auto' }}>{JSON.stringify(step.result ?? null, null, 1)}</pre>
        </div>
      )}
    </div>
  );
}

function useFlash(durationMs = 3200) {
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  const trigger = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), durationMs);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return [on, trigger];
}

function useFlashSet(durationMs = 2600) {
  const [active, setActive] = useState(() => new Set());
  const timers = useRef({});
  const trigger = (key) => {
    setActive((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      setActive((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, durationMs);
  };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  return [active, trigger];
}

// Events arrive in a burst; pace reveal for readability.
const REVEAL_DELAY_MS = 3500;

function useRevealQueue(delayMs = REVEAL_DELAY_MS) {
  const queueRef = useRef([]);
  const drainingRef = useRef(false);
  const timerRef = useRef(null);

  function drainOne() {
    if (queueRef.current.length === 0) {
      drainingRef.current = false;
      return;
    }
    const next = queueRef.current.shift();
    next();
    timerRef.current = setTimeout(drainOne, delayMs);
  }

  function enqueue(fn) {
    queueRef.current.push(fn);
    if (!drainingRef.current) {
      drainingRef.current = true;
      drainOne();
    }
  }

  function reset(fn) {
    queueRef.current = [];
    clearTimeout(timerRef.current);
    drainingRef.current = false;
    fn?.();
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { enqueue, reset };
}

export default function App() {
  const [connStatus, setConnStatus] = useState('connecting');
  const [active, setActive] = useState(null);
  const [inFlight, setInFlight] = useState([]);
  const [lastFailure, setLastFailure] = useState(null);
  const [recent, setRecent] = useState({ buyer: [], merchant: [] });
  const [auditLog, setAuditLog] = useState([]);
  const [paymentLog, setPaymentLog] = useState([]);
  const [paymentInFlight, setPaymentInFlight] = useState([]);
  const [viewingRecent, setViewingRecent] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Tracks the model's own call, not tool execution status.
  const [llmInFlight, setLlmInFlight] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const replayingRef = useRef(false);
  const replayTimersRef = useRef([]);

  const [requestArrowActive, flashRequestArrow] = useFlash();
  const [historyArrowActive, flashHistoryArrow] = useFlash();
  const [paymentArrowActive, flashPaymentArrow] = useFlash();
  const [webhookArrowActive, flashWebhookArrow] = useFlash();
  const [activeTools, flashTool] = useFlashSet();

  const revealQueue = useRevealQueue();

  const gridRef = useRef(null);
  const promptRef = useRef(null);
  const liveRef = useRef(null);
  const paymentRef = useRef(null);
  const webhookRef = useRef(null);
  const historyRef = useRef(null);
  const [anchors, setAnchors] = useState(null);

  useEffect(() => {
    function measure() {
      const g = gridRef.current;
      if (!g) return;
      const gRect = g.getBoundingClientRect();
      const rel = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left - gRect.left, top: r.top - gRect.top, right: r.right - gRect.left, bottom: r.bottom - gRect.top, width: r.width, height: r.height };
      };
      setAnchors({
        prompt: rel(promptRef.current),
        live: rel(liveRef.current),
        payment: rel(paymentRef.current),
        webhook: rel(webhookRef.current),
        history: rel(historyRef.current)
      });
    }
    measure();
    const ro = new ResizeObserver(measure);
    [gridRef.current, promptRef.current, liveRef.current, paymentRef.current, webhookRef.current, historyRef.current].forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/observability/stream`);
    es.onopen = () => setConnStatus('open');
    es.onerror = () => setConnStatus('error');

    es.addEventListener('snapshot', (e) => {
      const data = JSON.parse(e.data);
      setConnStatus('open');
      setRecent(data.recent || { buyer: [], merchant: [] });
      if (data.active) setActive({ ...data.active, finished: false, reply: null });
    });

    es.addEventListener('turn-start', (e) => {
      if (replayingRef.current) return;
      const data = JSON.parse(e.data);
      revealQueue.reset(() => {
        setViewingRecent(null);
        setInFlight([]);
        setLastFailure(null);
        setLlmInFlight(false);
        setActive({ ...data, steps: [], finished: false, reply: null });
      });
    });

    es.addEventListener('llm-call-start', () => {
      if (replayingRef.current) return;
      revealQueue.enqueue(() => {
        setLlmInFlight(true);
        flashRequestArrow();
      });
    });

    es.addEventListener('llm-call-end', () => {
      if (replayingRef.current) return;
      revealQueue.enqueue(() => {
        setLlmInFlight(false);
      });
    });

    es.addEventListener('step-start', (e) => {
      if (replayingRef.current) return;
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setInFlight((prev) => [...prev, data]);
        flashRequestArrow();
        flashTool(`${data.surface}:${data.name}`);
      });
    });

    es.addEventListener('step', (e) => {
      if (replayingRef.current) return;
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setInFlight((prev) => {
          const idx = prev.findIndex((s) => s.name === data.name);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
        setActive((prev) => (prev && prev.conversationId === data.conversationId ? { ...prev, steps: [...prev.steps, data] } : prev));
        if (data.outcome === 'denied') setLastFailure(data);
        flashHistoryArrow();
      });
    });

    es.addEventListener('turn-end', (e) => {
      if (replayingRef.current) return;
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setInFlight([]);
        setLlmInFlight(false);
        setActive((prev) => (prev && prev.conversationId === data.conversationId ? { ...prev, finished: true, reply: data.reply, stepsUsed: data.stepsUsed } : prev));
        setRecent((prev) => ({ ...prev, [data.surface]: [data, ...(prev[data.surface] || [])].slice(0, 8) }));
      });
    });

    es.addEventListener('audit', (e) => {
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setAuditLog((prev) => [data, ...prev].slice(0, AUDIT_LOG_LIMIT));
        if (String(data.action || '').startsWith('WEBHOOK')) flashWebhookArrow();
      });
    });

    es.addEventListener('payment-call-start', (e) => {
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setPaymentInFlight((prev) => [...prev, data]);
        flashPaymentArrow();
      });
    });

    es.addEventListener('payment-call', (e) => {
      const data = JSON.parse(e.data);
      revealQueue.enqueue(() => {
        setPaymentInFlight((prev) => {
          const idx = prev.findIndex((s) => s.name === data.name);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
        setPaymentLog((prev) => [data, ...prev].slice(0, AUDIT_LOG_LIMIT));
        flashPaymentArrow();
      });
    });

    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    replayingRef.current = replaying;
  }, [replaying]);

  function clearReplayTimers() {
    replayTimersRef.current.forEach(clearTimeout);
    replayTimersRef.current = [];
  }

  useEffect(() => clearReplayTimers, []);

  function stopReplay() {
    clearReplayTimers();
    setReplaying(false);
    setInFlight([]);
    setLlmInFlight(false);
  }

  // Walks the exact recorded step-start/step/turn-end sequence for a past
  // conversation, paced by the real gaps between its original timestamps.
  function replayConversation(entry) {
    setHistoryOpen(false);
    setViewingRecent(null);
    clearReplayTimers();

    const steps = [...(entry.steps || [])].sort((a, b) => a.startedAt - b.startedAt);
    const originStart = entry.startedAt ?? steps[0]?.startedAt ?? entry.endedAt;

    setReplaying(true);
    setInFlight([]);
    setLastFailure(null);
    setLlmInFlight(false);
    setActive({ surface: entry.surface, conversationId: entry.conversationId, message: entry.message, stepBudget: entry.stepBudget, startedAt: originStart, steps: [], finished: false, reply: null });

    steps.forEach((step) => {
      const startDelay = Math.max(0, step.startedAt - originStart);
      const endDelay = Math.max(startDelay, step.endedAt - originStart);
      replayTimersRef.current.push(
        setTimeout(() => {
          setInFlight((prev) => [...prev, step]);
          flashRequestArrow();
          flashTool(`${step.surface}:${step.name}`);
        }, startDelay)
      );
      replayTimersRef.current.push(
        setTimeout(() => {
          setInFlight((prev) => {
            const idx = prev.findIndex((s) => s.name === step.name);
            if (idx === -1) return prev;
            return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          });
          setActive((prev) => (prev && prev.conversationId === entry.conversationId ? { ...prev, steps: [...prev.steps, step] } : prev));
          if (step.outcome === 'denied') setLastFailure(step);
          flashHistoryArrow();
        }, endDelay)
      );
    });

    const turnEndDelay = Math.max(0, (entry.endedAt ?? originStart) - originStart);
    replayTimersRef.current.push(
      setTimeout(() => {
        setInFlight([]);
        setLlmInFlight(false);
        setActive((prev) => (prev && prev.conversationId === entry.conversationId ? { ...prev, finished: true, reply: entry.reply, stepsUsed: entry.stepsUsed } : prev));
        setReplaying(false);
      }, turnEndDelay)
    );
  }

  const display = viewingRecent || active;
  const stepsUsedNow = display?.finished ? display.stepsUsed : display?.steps?.length || 0;

  const budgetSegments = useMemo(() => {
    if (!display) return [];
    return Array.from({ length: display.stepBudget }, (_, i) => i < stepsUsedNow);
  }, [display, stepsUsedNow]);

  const requestArrowLabel = !display
    ? 'AWAITING REQUEST'
    : inFlight.length > 0
      ? callKind(inFlight[0])
      : llmInFlight
        ? 'LLM API CALL — AGENT REASONING'
        : display.finished
          ? 'TURN COMPLETE'
          : 'AWAITING NEXT STEP';

  const requestArrowHue = llmInFlight && inFlight.length === 0 ? 'ai' : 'cyan';

  const webhookEntries = useMemo(() => auditLog.filter((a) => String(a.action || '').startsWith('WEBHOOK')), [auditLog]);

  const recentCombined = useMemo(
    () =>
      [...recent.buyer.map((r) => ({ ...r, surface: 'buyer' })), ...recent.merchant.map((r) => ({ ...r, surface: 'merchant' }))].sort(
        (a, b) => b.endedAt - a.endedAt
      ),
    [recent]
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', flexShrink: 0, position: 'relative' }}>
        <span
          className={connStatus === 'open' ? 'pulse-dot' : ''}
          style={{ width: 8, height: 8, background: connStatus === 'open' ? 'var(--code)' : connStatus === 'error' ? 'var(--fail)' : 'var(--warn)', color: connStatus === 'open' ? 'var(--code)' : 'var(--fail)' }}
        />
        <span style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          {connStatus === 'open' ? 'link established' : connStatus === 'error' ? 'link lost' : 'connecting…'}
        </span>

        {viewingRecent && !replaying && (
          <button
            type="button"
            onClick={() => setViewingRecent(null)}
            className="press-on-active"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,176,32,0.12)',
              border: '1px solid rgba(255,176,32,0.5)',
              color: 'var(--warn)',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            ● viewing past request — back to live
          </button>
        )}

        {replaying && (
          <button
            type="button"
            onClick={stopReplay}
            className="press-on-active blink-slow"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(192,132,255,0.14)',
              border: '1px solid var(--ai)',
              color: 'var(--ai)',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            ▶ replaying — click to stop
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="press-on-active"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: historyOpen ? 'rgba(0,229,255,0.14)' : 'rgba(0,229,255,0.05)',
              border: `1px solid ${historyOpen ? 'var(--cyan)' : 'rgba(0,229,255,0.3)'}`,
              color: 'var(--cyan)',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            history {recentCombined.length > 0 ? `(${recentCombined.length})` : ''}
          </button>

          {historyOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                width: 340,
                maxHeight: 360,
                overflowY: 'auto',
                background: 'var(--panel-bg-strong)',
                border: '1px solid var(--line-bright)',
                boxShadow: '0 12px 34px rgba(0,0,0,0.55)',
                zIndex: 20,
                padding: 8
              }}
            >
              {recentCombined.length === 0 ? (
                <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-faint)', padding: '6px 4px' }}>No finished requests yet this session.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {recentCombined.map((r) => (
                    <div key={r.conversationId + r.endedAt} style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingRecent({ ...r, finished: true, steps: r.steps || [] });
                          setHistoryOpen(false);
                        }}
                        style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)', padding: '6px 8px', color: 'var(--text)', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Tag color={r.surface === 'buyer' ? 'var(--ai)' : 'var(--warn)'}>{r.surface}</Tag>
                          <span style={{ fontSize: 9.5, opacity: 0.45 }}>{formatTime(r.endedAt)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 10.5, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</p>
                      </button>
                      <button
                        type="button"
                        title="Replay this request's exact event sequence"
                        onClick={() => replayConversation(r)}
                        disabled={!r.steps?.length}
                        className="press-on-active"
                        style={{
                          flexShrink: 0,
                          width: 34,
                          background: 'rgba(192,132,255,0.1)',
                          border: '1px solid rgba(192,132,255,0.4)',
                          color: r.steps?.length ? 'var(--ai)' : 'var(--text-faint)',
                          cursor: r.steps?.length ? 'pointer' : 'not-allowed',
                          fontSize: 13
                        }}
                      >
                        ▶
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, letterSpacing: '0.22em', color: 'var(--cyan)', textShadow: '0 0 14px rgba(0,229,255,0.55)' }}>
          AGENT&nbsp;OBSERVABILITY
        </span>
      </div>

      {/* 12px gap made connector lines invisible; widened to 40px. */}
      <div ref={gridRef} style={{ position: 'relative', flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 210px 210px 230px', gridTemplateRows: '210px 1fr', gap: 40, padding: 20, minHeight: 0 }}>
        {anchors && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
            <defs>
              <marker id="arrow-cyan-active" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--cyan)" />
              </marker>
              <marker id="arrow-cyan-dim" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(0,229,255,0.55)" />
              </marker>
              <marker id="arrow-ai-active" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--ai)" />
              </marker>
              <marker id="arrow-ai-dim" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(192,132,255,0.55)" />
              </marker>
            </defs>
            <FlowArrow from={anchors.prompt} to={anchors.live} axis="h" label={requestArrowLabel} active={requestArrowActive} hue={requestArrowHue} />
            <FlowArrow from={anchors.live} to={anchors.payment} axis="h" label="RAZORPAY API" active={paymentArrowActive} />
            <FlowArrow from={anchors.live} to={anchors.history} axis="v" label="RESOLVED" active={historyArrowActive} />
            <FlowArrow from={anchors.payment} to={anchors.webhook} axis="v" label="WEBHOOK CONFIRM" active={webhookArrowActive} />
          </svg>
        )}

        <HudPanel
          ref={promptRef}
          title="User Request"
          right={display ? <Tag color={display.surface === 'buyer' ? 'var(--ai)' : 'var(--warn)'}>{display.surface}</Tag> : null}
          style={{ gridColumn: '1 / 2', gridRow: '1 / 2', zIndex: 2 }}
        >
          {!display ? (
            <div>
              <p className="blink-slow" style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', color: 'var(--text-faint)' }}>
                SYSTEM IDLE
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 10.5, color: 'var(--text-dim)' }}>Awaiting a request from either surface.</p>
              {recentCombined.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {recentCombined.slice(0, 6).map((r) => (
                      <div key={r.conversationId + r.endedAt} style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
                        <button
                          type="button"
                          onClick={() => setViewingRecent({ ...r, finished: true, steps: r.steps || [] })}
                          style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)', padding: '6px 8px', color: 'var(--text)', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <Tag color={r.surface === 'buyer' ? 'var(--ai)' : 'var(--warn)'}>{r.surface}</Tag>
                            <span style={{ fontSize: 9.5, opacity: 0.45 }}>{formatTime(r.endedAt)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 10.5, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</p>
                        </button>
                        <button
                          type="button"
                          title="Replay this request's exact event sequence"
                          onClick={() => replayConversation(r)}
                          disabled={!r.steps?.length}
                          className="press-on-active"
                          style={{
                            flexShrink: 0,
                            width: 34,
                            background: 'rgba(192,132,255,0.1)',
                            border: '1px solid rgba(192,132,255,0.4)',
                            color: r.steps?.length ? 'var(--ai)' : 'var(--text-faint)',
                            cursor: r.steps?.length ? 'pointer' : 'not-allowed',
                            fontSize: 13
                          }}
                        >
                          ▶
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 12, lineHeight: 1.5 }}>{display.message}</p>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>
                  <span>Step budget</span>
                  <span>
                    {stepsUsedNow} / {display.stepBudget}
                  </span>
                </div>
                <div className="segment-bar">
                  {budgetSegments.map((lit, i) => (
                    <div key={i} className={`segment ${lit ? 'lit' : ''}`} />
                  ))}
                </div>
              </div>
            </>
          )}
        </HudPanel>

        <HudPanel
          ref={liveRef}
          title="Tool Being Called"
          tone="live"
          right={display && !display.finished ? <Tag color="var(--cyan)">real time</Tag> : <Tag color="var(--text-faint)">idle</Tag>}
          style={{ gridColumn: '2 / 3', gridRow: '1 / 2', zIndex: 2 }}
        >
          {!display ? (
            <p className="blink-slow" style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>STANDBY — no active session</p>
          ) : display.finished ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>Turn complete. Nothing in flight.</p>
          ) : inFlight.length === 0 && llmInFlight ? (
            <div className="flicker-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pulse-dot" style={{ background: 'var(--ai)', color: 'var(--ai)' }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--ai)', textShadow: '0 0 10px rgba(192,132,255,0.5)' }}>LLM API CALL</span>
                <div style={{ fontSize: 9.5, color: 'var(--text-faint)', marginTop: 2 }}>Agent reasoning — deciding the next action</div>
              </div>
            </div>
          ) : inFlight.length === 0 ? (
            <p className="blink-slow" style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>model is deciding what to call…</p>
          ) : (
            inFlight.map((s, i) => (
              <div key={i} className="flicker-in" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="pulse-dot" style={{ background: 'var(--cyan)', color: 'var(--cyan)' }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--cyan)', textShadow: '0 0 10px rgba(0,229,255,0.5)' }}>{formatName(s.name)}</span>
                  <div style={{ fontSize: 9.5, color: 'var(--text-faint)', marginTop: 2 }}>{callKind(s)}</div>
                </div>
              </div>
            ))
          )}
        </HudPanel>

        <HudPanel
          ref={paymentRef}
          title="Payment Gateway"
          tone={paymentInFlight.length > 0 ? 'live' : undefined}
          right={<span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{paymentLog.length} call(s)</span>}
          style={{ gridColumn: '3 / 4', gridRow: '1 / 2', zIndex: 2 }}
        >
          {paymentInFlight.length === 0 && paymentLog.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>No Razorpay calls yet.</p>
          ) : (
            <>
              {paymentInFlight.map((s, i) => (
                <div key={`live-${i}`} className="flicker-in" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                  <span className="pulse-dot" style={{ background: 'var(--cyan)', color: 'var(--cyan)' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--cyan)' }}>{formatName(s.name)}</span>
                </div>
              ))}
              {paymentLog.slice(0, 6).map((p, i) => (
                <div key={i} className="flicker-in" style={{ marginBottom: 7, paddingBottom: 7, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 10.5 }}>{formatName(p.name)}</span>
                    <Tag color={p.result?.simulated ? 'var(--cyan)' : 'var(--code)'}>{formatPaymentMethod(p.result)}</Tag>
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-faint)', marginTop: 2 }}>
                    {p.result?.status} · ₹{p.result?.amount} · {formatDuration(p.durationMs)}
                  </div>
                </div>
              ))}
            </>
          )}
        </HudPanel>

        <HudPanel title="Failure State" tone={lastFailure ? 'fail' : undefined} right={lastFailure ? <Tag color="var(--fail)">triggered</Tag> : null} style={{ gridColumn: '4 / 5', gridRow: '1 / 2', zIndex: 2 }}>
          {!lastFailure ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>{display ? 'No guard rail has fired this turn.' : 'No guard rail activity to report.'}</p>
          ) : (
            <div className="flicker-in">
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: 'var(--fail)' }}>{formatName(lastFailure.name)}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>{summarize(lastFailure.result)}</p>
            </div>
          )}
        </HudPanel>

        <HudPanel
          title="Full Audit Log"
          right={<span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{auditLog.length} record(s)</span>}
          style={{ gridColumn: '1 / 2', gridRow: '2 / 3', zIndex: 2 }}
        >
          {auditLog.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>Nothing written to the audit trail yet.</p>
          ) : (
            auditLog.map((a, i) => (
              <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 10.5 }}>{a.action}</span>
                  <span style={{ fontSize: 9.5, color: a.decision === 'DENIED' ? 'var(--fail)' : 'var(--code)' }}>{a.decision}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-faint)' }}>
                  <span>{formatTime(a.timestamp)}</span>
                  {a.amount != null && <span>₹{a.amount}</span>}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 10.5, color: 'var(--text-dim)' }}>{humanizeReason(a.reason)}</p>
              </div>
            ))
          )}
        </HudPanel>

        <HudPanel
          ref={historyRef}
          title="Tools Called Successfully"
          right={<span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{display?.steps?.length || 0} step(s)</span>}
          style={{ gridColumn: '2 / 4', gridRow: '2 / 3', zIndex: 2 }}
        >
          {!display ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>SYSTEM IDLE — no steps recorded.</p>
          ) : (
            <>
              {display.finished && display.reply && (
                <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(0,229,255,0.15)' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ai)' }}>Final reply (AI lane)</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text)' }}>{display.reply}</p>
                </div>
              )}
              {!display.steps || display.steps.length === 0 ? (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>No tool has resolved yet.</p>
              ) : (
                display.steps.map((s, i) => <StepCard key={i} step={s} />)
              )}
            </>
          )}
        </HudPanel>

        <HudPanel
          ref={webhookRef}
          title="Webhooks"
          right={<span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{webhookEntries.length} delivered</span>}
          style={{ gridColumn: '4 / 5', gridRow: '2 / 3', zIndex: 2 }}
        >
          {webhookEntries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)' }}>No webhook deliveries yet.</p>
          ) : (
            webhookEntries.map((a, i) => (
              <div key={i} className="flicker-in" style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 10.5 }}>{a.result}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{formatTime(a.timestamp)}</span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{humanizeReason(a.reason)}</p>
              </div>
            ))
          )}
        </HudPanel>

        <HudPanel
          title="Agent Tools"
          right={<span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{BUYER_TOOLS.length + MERCHANT_TOOLS.length} total</span>}
          style={{ gridColumn: '5 / 6', gridRow: '1 / 3', zIndex: 2 }}
        >
          <div style={{ marginBottom: 6 }}>
            <p style={{ margin: '0 0 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ai)' }}>Buyer ({BUYER_TOOLS.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {BUYER_TOOLS.map((name) => {
                const on = activeTools.has(`buyer:${name}`);
                return (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px',
                      fontSize: 10,
                      fontWeight: on ? 800 : 500,
                      color: on ? 'var(--ai)' : 'var(--text-dim)',
                      background: on ? 'rgba(192,132,255,0.14)' : 'transparent',
                      border: `1px solid ${on ? 'rgba(192,132,255,0.5)' : 'transparent'}`,
                      textShadow: on ? '0 0 8px rgba(192,132,255,0.6)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: 5, height: 5, flexShrink: 0, background: on ? 'var(--ai)' : 'rgba(255,255,255,0.15)', boxShadow: on ? '0 0 6px var(--ai)' : 'none' }} />
                    {formatName(name)}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--warn)' }}>Merchant ({MERCHANT_TOOLS.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MERCHANT_TOOLS.map((name) => {
                const on = activeTools.has(`merchant:${name}`);
                return (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px',
                      fontSize: 10,
                      fontWeight: on ? 800 : 500,
                      color: on ? 'var(--warn)' : 'var(--text-dim)',
                      background: on ? 'rgba(255,176,32,0.14)' : 'transparent',
                      border: `1px solid ${on ? 'rgba(255,176,32,0.5)' : 'transparent'}`,
                      textShadow: on ? '0 0 8px rgba(255,176,32,0.6)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: 5, height: 5, flexShrink: 0, background: on ? 'var(--warn)' : 'rgba(255,255,255,0.15)', boxShadow: on ? '0 0 6px var(--warn)' : 'none' }} />
                    {formatName(name)}
                  </div>
                );
              })}
            </div>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
