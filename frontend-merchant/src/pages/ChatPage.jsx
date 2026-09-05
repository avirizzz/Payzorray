import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useMerchant } from '../context/MerchantContext';
import { chatWithMerchantAgent, getDiagnosis, createCouponCampaign, createBundleCampaign, getReadiness } from '../api/merchant';
import { Link } from 'react-router-dom';
import { ArrowUpIcon, SparkleIcon } from '../components/ui/icons';
import Alert from '../components/ui/Alert';
import StreamingText from '../components/chat/StreamingText';
import AttachmentCard from '../components/chat/AttachmentCard';
import StatsCard from '../components/chat/StatsCard';
import CampaignFormCard from '../components/chat/CampaignFormCard';

const WELCOME = "Ask me anything about your store -- how it's doing, recent orders, or what to fix in your catalog.";

const SUGGESTIONS = ["How's my store doing?", 'What should I fix in my catalog?', 'Any recent orders I should know about?'];

// Shortcuts fill in real questions; never bypass the agent's tools.
const STAT_VIEWS = [
  { view: 'overview', label: 'Overview', sends: 'Give me an overall read on my store performance.' },
  { view: 'revenue', label: 'Revenue trend', sends: 'How has my revenue moved day to day recently?' },
  { view: 'products', label: 'Top products', sends: 'Which products are making me the most money?' },
  { view: 'categories', label: 'Categories', sends: 'Which categories drive my revenue?' },
  { view: 'payments', label: 'Payments', sends: 'How are my payments doing -- any failures or refunds?' },
  { view: 'customers', label: 'Customers', sends: 'What do my customers look like -- repeat rate and value?' },
  { view: 'inventory', label: 'Inventory', sends: 'What does my stock position look like?' }
];

// Creation requires the merchant to submit the form.
const CAMPAIGN_ACTIONS = [
  { key: 'suggest', label: 'Suggest campaigns from my data' },
  { key: 'performance', label: 'How are my campaigns doing?', sends: 'How are my campaigns and add-on offers performing?' },
  { key: 'new_coupon', label: 'Create a coupon' },
  { key: 'new_bundle', label: 'Create a bundle' }
];

const UPSELL_ACTIONS = [
  { key: 'performance', label: 'How are add-ons performing?', sends: 'How are my add-on offers performing -- offered, accepted and declined?' },
  { key: 'best', label: 'Which add-ons get accepted?', sends: 'Which add-on products get accepted most often, and which get declined?' },
  { key: 'why', label: "Why aren't offers converting?", sends: "My add-on offers aren't converting well. Based on my real numbers, what's likely going on and what should I change?" },
  { key: 'new_bundle', label: 'Create a bundle' }
];

const SLASH_COMMANDS = [
  { cmd: '/stats', desc: 'Charts for any part of the business' },
  { cmd: '/campaigns', desc: 'Suggest, review or create a campaign' },
  { cmd: '/orders', desc: 'Recent order activity', sends: 'What has been happening with my recent orders?' },
  { cmd: '/fix', desc: 'Listings hurting AI findability', sends: 'Which listings should I fix first, and why?' },
  { cmd: '/upsell', desc: 'Add-on offers: performance or a new bundle' },
  { cmd: '/clear', desc: 'Start a fresh conversation' },
  { cmd: '/help', desc: 'List commands' }
];

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

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <Avatar />
      <div style={{ display: 'flex', gap: '3px' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#ffffff',
              animation: 'merchant-typing-bounce 1.2s infinite',
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes merchant-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Bubble({ message, streamed, onStreamTick, onPickOption, onCampaignAction, onApprove, onSubmitForm, catalog, pending }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      {!isUser && <Avatar />}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {message.attachment && (
          <div style={{ width: '100%', maxWidth: 380 }}>
            <AttachmentCard attachment={message.attachment} compact />
          </div>
        )}

        <div
          className={isUser ? '' : 'glass-card'}
          style={{
            width: 'fit-content',
            padding: '12px 18px',
            borderRadius: 'var(--radius-panel)',
            borderTopRightRadius: isUser ? '4px' : undefined,
            borderTopLeftRadius: isUser ? undefined : '4px',
            background: isUser ? '#ffffff' : undefined,
            border: isUser ? 'none' : undefined,
            boxShadow: isUser ? '0 6px 18px rgba(1,15,40,0.22)' : undefined,
            color: isUser ? 'var(--color-blue)' : '#ffffff',
            fontWeight: isUser ? 600 : 400,
            fontSize: 'var(--text-sm)',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere'
          }}
        >
          {isUser ? (
            message.content
          ) : (
            <StreamingText text={message.content} message={message} streamed={streamed} onDone={onStreamTick} />
          )}
        </div>

        {message.analytics && message.chartView && (
          <div style={{ width: '100%' }}>
            <StatsCard analytics={message.analytics} view={message.chartView} />
          </div>
        )}

        {message.options && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {message.options.map((o) => (
              <button key={o.view} type="button" onClick={() => onPickOption(o)} className="ask-btn press-on-active">
                {o.label}
              </button>
            ))}
          </div>
        )}

        {message.campaignActions && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {message.campaignActions.map((a) => (
              <button key={a.key} type="button" onClick={() => onCampaignAction(a)} className="ask-btn press-on-active">
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Creates nothing until merchant approves */}
        {message.suggestions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {message.suggestions.map((s, i) => (
              <div key={i} className="glass-card glass-card-row" style={{ padding: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <SparkleIcon size={12} />
                  <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, opacity: 0.8 }}>
                    {s.kind === 'coupon' ? 'Coupon campaign' : 'Bundle campaign'}
                  </span>
                </div>
                <p style={{ margin: '0 0 5px', fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>{s.reason}</p>
                <p className="gauge-number" style={{ margin: '0 0 10px', fontSize: '0.7rem', opacity: 0.8 }}>
                  {s.kind === 'coupon'
                    ? `${s.scope_type} "${s.scope_value}" · ${s.suggested_discount_value}% (range ${s.discount_range.min}-${s.discount_range.max}%)`
                    : `${s.primary_product_name} + ${s.paired_product_name} · ${s.suggested_discount_value}%`}
                </p>
                <button type="button" onClick={() => onApprove(s)} className="ask-btn press-on-active">
                  Approve &amp; create
                </button>
              </div>
            ))}
          </div>
        )}

        {message.campaignForm && (
          <CampaignFormCard
            kind={message.campaignForm.kind}
            done={message.campaignForm.done}
            disabled={pending}
            products={catalog}
            categories={[...new Set(catalog.map((p) => p.category).filter(Boolean))]}
            onSubmit={(values) => onSubmitForm(message.campaignForm.id, values)}
          />
        )}

        {message.linkTo && (
          <Link to={message.linkTo} style={{ textDecoration: 'none' }}>
            <button type="button" className="ask-btn press-on-active">{message.linkLabel}</button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { merchantId } = useMerchant();
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }]);
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const listEndRef = useRef(null);
  const inputRef = useRef(null);
  // Identity-keyed: finished replies never replay on re-render.
  const streamedRef = useRef(new WeakSet());

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  // Merchant writes own question; nothing pre-phrased or auto-sent.
  useEffect(() => {
    const incoming = location.state?.attachment;
    if (!incoming) return;
    setAttachment(incoming);
    navigate(location.pathname, { replace: true, state: null });
    inputRef.current?.focus();
  }, [location.state, location.pathname, navigate]);

  // displayAs shows what merchant typed; agent gets expanded text.
  async function sendMessage(text, chartView, displayAs) {
    if (!text || pending || !merchantId) return;

    // UI-only slash commands never reach the agent.
    if (text.startsWith('/')) {
      const rawTyped = text;
      const [typed] = text.toLowerCase().split(/\s+/);
      const command = SLASH_COMMANDS.find((c) => c.cmd === typed);

      // /clear needs no echo: thread gets wiped anyway.
      if (command?.cmd === '/clear') {
        setMessages([{ role: 'assistant', content: WELCOME }]);
        setValue('');
        setAttachment(null);
        setError(null);
        return;
      }

      const echo = { role: 'user', content: rawTyped };
      if (command?.cmd === '/stats') {
        setMessages((m) => [...m, echo, { role: 'assistant', content: 'Which part of the business do you want to see?', options: STAT_VIEWS }]);
        setValue('');
        return;
      }
      if (command?.cmd === '/campaigns') {
        setMessages((m) => [
          ...m,
          echo,
          { role: 'assistant', content: 'Campaigns add an optional discount buyers can apply. What would you like to do?', campaignActions: CAMPAIGN_ACTIONS }
        ]);
        setValue('');
        return;
      }
      if (command?.cmd === '/upsell') {
        setMessages((m) => [
          ...m,
          echo,
          { role: 'assistant', content: 'Add-on offers are what the agent suggests alongside something already in the cart. What do you want to look at?', campaignActions: UPSELL_ACTIONS }
        ]);
        setValue('');
        return;
      }
      if (command?.cmd === '/help') {
        setMessages((m) => [
          ...m,
          echo,
          { role: 'assistant', content: SLASH_COMMANDS.map((c) => `${c.cmd} — ${c.desc}`).join('\n') }
        ]);
        setValue('');
        return;
      }
      if (command?.sends) {
        displayAs = rawTyped;
        text = command.sends;
      } else if (!command) {
        setMessages((m) => [
          ...m,
          echo,
          { role: 'assistant', content: `${typed} isn't a command. Type /help to see what's available.` }
        ]);
        setValue('');
        return;
      }
    }

    const sentAttachment = attachment;
    const history = messages;

    setMessages((m) => [...m, { role: 'user', content: displayAs || text, attachment: sentAttachment }]);
    setValue('');
    setAttachment(null);
    setPending(true);
    setError(null);

    // Merchant's words kept verbatim; context is appended around them.
    const outgoing = sentAttachment ? `${sentAttachment.context}\n\nMy question: ${text}` : text;

    try {
      const result = await chatWithMerchantAgent({ merchantId, message: outgoing, history });
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: result.reply,
          // Chart only what the agent actually pulled this turn.
          analytics: result.analytics || null,
          chartView: chartView || (result.analytics ? 'overview' : null)
        }
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(value.trim());
  }

  async function handleCampaignAction(action) {
    if (action.sends) return sendMessage(action.sends);

    if (action.key === 'new_coupon' || action.key === 'new_bundle') {
      const kind = action.key === 'new_coupon' ? 'coupon' : 'bundle';
      if (!catalog.length) {
        try {
          const { products } = await getReadiness(merchantId);
          setCatalog(products);
        } catch {
          /* form still works for whole-catalog coupons */
        }
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            kind === 'coupon'
              ? 'Set the code, discount and what it applies to. It goes live as soon as you create it.'
              : 'Pick the product a buyer is already taking, then what to offer alongside it and at what discount.',
          campaignForm: { kind, id: `cf_${Date.now()}` }
        }
      ]);
      return;
    }

    if (action.key === 'suggest') {
      setPending(true);
      setError(null);
      try {
        const d = await getDiagnosis(merchantId);
        const suggestions = d.suggested_campaigns || [];
        setMessages((m) => [
          ...m,
          suggestions.length
            ? { role: 'assistant', content: "Here's what your data suggests. Nothing is created until you approve it.", suggestions }
            : { role: 'assistant', content: "Nothing stands out for a campaign right now -- no idle categories or unsold listings worth discounting." }
        ]);
      } catch (err) {
        setError(err.message);
      } finally {
        setPending(false);
      }
    }
  }

  // Same creation endpoints as everywhere; no separate path here.
  async function submitCampaignForm(formId, values) {
    setPending(true);
    setError(null);
    try {
      let confirmation;
      if (values.kind === 'coupon') {
        const code = values.code.trim().toUpperCase();
        await createCouponCampaign({
          merchant_id: merchantId,
          code,
          discount_type: values.discount_type,
          discount_value: Number(values.discount_value),
          scope_type: values.scope_type,
          scope_value: values.scope_type === 'all' ? null : values.scope_value
        });
        const where =
          values.scope_type === 'all'
            ? 'your whole catalog'
            : values.scope_type === 'category'
              ? `"${values.scope_value}"`
              : catalog.find((p) => p.product_id === values.scope_value)?.name || values.scope_value;
        confirmation = `Created ${code} — ${values.discount_type === 'percent' ? `${values.discount_value}%` : `₹${values.discount_value}`} off ${where}. Buyers will see it at the checkout coupon step.`;
      } else {
        await createBundleCampaign({
          merchant_id: merchantId,
          primary_product_id: values.primary_product_id,
          paired_product_id: values.paired_product_id,
          discount_type: values.discount_type,
          discount_value: Number(values.discount_value)
        });
        const nameOf = (id) => catalog.find((p) => p.product_id === id)?.name || id;
        confirmation = `Created a bundle — buyers taking "${nameOf(values.primary_product_id)}" will be offered "${nameOf(values.paired_product_id)}" at ${values.discount_type === 'percent' ? `${values.discount_value}%` : `₹${values.discount_value}`} off.`;
      }

      setMessages((m) => [
        ...m.map((msg) => (msg.campaignForm?.id === formId ? { ...msg, campaignForm: { ...msg.campaignForm, done: true } } : msg)),
        { role: 'assistant', content: confirmation }
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function approveSuggestion(s) {
    setPending(true);
    setError(null);
    try {
      if (s.kind === 'coupon') {
        const code = `${s.scope_type === 'product' ? 'PROD' : 'CAT'}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        await createCouponCampaign({
          merchant_id: merchantId,
          code,
          description: s.reason,
          discount_type: s.suggested_discount_type,
          discount_value: s.suggested_discount_value,
          scope_type: s.scope_type,
          scope_value: s.scope_value
        });
        setMessages((m) => [...m, { role: 'assistant', content: `Created coupon ${code} — ${s.suggested_discount_value}% off ${s.scope_type === 'product' ? 'that product' : `"${s.scope_value}"`}. Buyers will see it at checkout.` }]);
      } else {
        await createBundleCampaign({
          merchant_id: merchantId,
          primary_product_id: s.primary_product_id,
          paired_product_id: s.paired_product_id,
          discount_type: s.suggested_discount_type,
          discount_value: s.suggested_discount_value
        });
        setMessages((m) => [...m, { role: 'assistant', content: `Created a bundle — buyers taking "${s.primary_product_name}" will be offered "${s.paired_product_name}" at ${s.suggested_discount_value}% off.` }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  const matchingCommands = value.startsWith('/')
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase().split(/\s+/)[0]))
    : [];

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 760, margin: '0 auto' }}>
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <span className="page-eyebrow">Answers from your real data</span>
          <h1 className="page-title">Ask your store</h1>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          {messages.map((m, i) => (
            <Bubble
              key={i}
              message={m}
              streamed={streamedRef.current}
              onStreamTick={() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              onPickOption={(o) => sendMessage(o.sends, o.view)}
              onCampaignAction={handleCampaignAction}
              onApprove={approveSuggestion}
              onSubmitForm={submitCampaignForm}
              catalog={catalog}
              pending={pending}
            />
          ))}

          {messages.length === 1 && !pending && !attachment && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '40px' }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => sendMessage(s)} className="ask-btn press-on-active">
                  {s}
                </button>
              ))}
              {/* Same flow as /campaigns, surfaced without needing the slash command */}
              <button
                type="button"
                onClick={() => {
                  setMessages((m) => [...m, { role: 'user', content: 'Suggest campaigns from my data' }]);
                  handleCampaignAction({ key: 'suggest' });
                }}
                className="ask-btn press-on-active"
              >
                What campaigns should I run?
              </button>
            </div>
          )}

          {pending && <TypingIndicator />}
          {error && (
            <Alert variant="destructive" title="Couldn't get a reply">
              {error}
            </Alert>
          )}
          <div ref={listEndRef} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {matchingCommands.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {matchingCommands.map((c) => (
                <button
                  key={c.cmd}
                  type="button"
                  onClick={() => {
                    setValue(c.cmd);
                    inputRef.current?.focus();
                  }}
                  className="glass-card glass-card-row press-on-active"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    border: 'none',
                    padding: '7px 12px',
                    color: '#fff',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer'
                  }}
                >
                  <span className="gauge-number" style={{ fontWeight: 800 }}>{c.cmd}</span>
                  <span style={{ opacity: 0.8 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          )}

          {attachment && <AttachmentCard attachment={attachment} onRemove={() => setAttachment(null)} />}

          <form
            onSubmit={handleSubmit}
            className="glass-card glass-card-strong"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px 10px 18px' }}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={attachment ? 'Ask anything about this...' : 'Ask anything, or type / for commands...'}
              disabled={pending}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-base)',
                color: '#ffffff'
              }}
            />
            <button
              type="submit"
              disabled={pending}
              aria-label="Send"
              className="press-on-active"
              style={{
                width: '38px',
                height: '38px',
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--gradient-accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowUpIcon size={17} />
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
