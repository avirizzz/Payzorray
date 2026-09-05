import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SparkleIcon, SearchIcon, LockIcon, OrdersIcon, CatalogIcon, ChartIcon, AlertIcon, ChatIcon } from '../components/ui/icons';

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4';
const BUYER_APP_URL = import.meta.env.VITE_BUYER_APP_URL || 'http://localhost:5174';

const SHOPPER_FEATURES = [
  { Icon: SparkleIcon, title: 'An AI agent shops for you', body: 'Say what you want in plain words -- it searches, compares, and buys.' },
  { Icon: SearchIcon, title: 'Real products, real prices', body: "Every listing comes straight from a merchant's live catalog." },
  { Icon: LockIcon, title: 'Nothing charges without you', body: 'Payments run through Razorpay -- you approve every charge.' },
  { Icon: OrdersIcon, title: 'Track every order', body: 'Status, tracking, and refunds, all in one place.' }
];

const MERCHANT_FEATURES = [
  { Icon: CatalogIcon, title: 'List once, get found', body: 'AI shopping agents can search and buy your products the same day.' },
  { Icon: ChartIcon, title: 'A real revenue dashboard', body: 'Live revenue, orders, and average order value -- no spreadsheets.' },
  { Icon: AlertIcon, title: 'Know what to fix', body: 'See which listings are too vague for AI search to find.' },
  { Icon: ChatIcon, title: 'Ask your store anything', body: 'A chat agent that answers with your real numbers, not guesses.' }
];

const SHOPPER_STEPS = [
  {
    Icon: ChatIcon,
    step: '01',
    title: 'Tell your agent what you want',
    body: 'Plain language, no forms -- "find me a red hoodie under ₹1500" is a real query, not a filter panel.'
  },
  {
    Icon: SearchIcon,
    step: '02',
    title: 'It searches and compares for you',
    body: 'Your agent checks real listings across merchants, weighs price and fit, and tells you honestly what it found.'
  },
  {
    Icon: OrdersIcon,
    step: '03',
    title: 'You approve, pay, and track',
    body: 'Nothing charges without your confirmation. Once it does, tracking and refunds live in one place.'
  }
];

const MERCHANT_STEPS = [
  {
    Icon: CatalogIcon,
    step: '01',
    title: 'List your catalog',
    body: 'Add your products once. Price, stock, description -- the same data an AI shopping agent needs to actually find and evaluate them.'
  },
  {
    Icon: SparkleIcon,
    step: '02',
    title: 'AI agents find and buy',
    body: 'A shopper tells their agent what they want in plain language. It searches real listings, compares them, and buys straight from your catalog.'
  },
  {
    Icon: ChartIcon,
    step: '03',
    title: 'You fulfill, get paid, and learn',
    body: 'The order lands on your dashboard like any other sale -- and your Catalog page shows exactly what to fix if agents keep missing a listing.'
  }
];

function FeatureRow({ Icon, title, body }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 'var(--radius)',
          background: 'var(--color-surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>{title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', opacity: 0.8, lineHeight: 1.5 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

function StepRow({ Icon, step, title, body }) {
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 'var(--radius)',
          background: 'var(--gradient-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff'
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="brand-mono" style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', opacity: 0.55 }}>
            {step}
          </span>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>{title}</p>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', opacity: 0.8, lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-bg" style={{ position: 'relative', width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .landing-headline { font-size: 52px; letter-spacing: -1.5px; }
        .landing-nav-links { display: flex; }
        .landing-nav-ctas { display: flex; }
        @media (max-width: 780px) {
          .landing-headline { font-size: clamp(30px, 8vw, 42px); letter-spacing: -0.06em; }
          .landing-nav-links { display: none; }
          .landing-nav-ctas { gap: 8px !important; }
          .landing-features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px clamp(20px, 5vw, 56px)'
        }}
      >
        <img src="/payzorray-logo.png" alt="Payzorray" style={{ height: 84, width: 'auto' }} />
        <div className="landing-nav-links" style={{ gap: '28px', alignItems: 'center' }}>
          <a href="#how-it-works" style={{ textDecoration: 'none', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: 0.9 }}>
            How it works
          </a>
          <a href="#features" style={{ textDecoration: 'none', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: 0.9 }}>
            Features
          </a>
          <a href="#get-started" style={{ textDecoration: 'none', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600, opacity: 0.9 }}>
            Get Started
          </a>
        </div>
        <div className="landing-nav-ctas" style={{ gap: '10px' }}>
          <a href={BUYER_APP_URL} style={{ textDecoration: 'none' }}>
            <Button variant="ghost" style={{ padding: '9px 16px', fontSize: 'var(--text-xs)' }}>
              Shop with AI
            </Button>
          </a>
          <Link to="/pick" style={{ textDecoration: 'none' }}>
            <Button variant="primary" style={{ padding: '9px 16px', fontSize: 'var(--text-xs)' }}>
              For Merchants
            </Button>
          </Link>
        </div>
      </nav>

      <section style={{ position: 'relative', minHeight: '100svh', width: '100%', background: '#000000' }}>
        <video
          src={VIDEO_URL}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 1 }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }} />

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
            width: 'min(600px, calc(100% - 40px))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '28px'
          }}
        >
          <h1
            className="brand-heading landing-headline"
            style={{
              margin: 0,
              lineHeight: 1.15
            }}
          >
            The bridge was broken.
            <br />
            We built it.
          </h1>

          <p style={{ margin: 0, fontSize: 'var(--text-md)', color: '#fff', opacity: 0.9, lineHeight: 1.5, fontWeight: 500 }}>
            Payzorray connects real shops to AI shopping agents -- list once, and let AI buyers find and buy the same day.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href={BUYER_APP_URL} style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ padding: '13px 26px' }}>
                Shop with AI
              </Button>
            </a>
            <Link to="/pick" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" style={{ padding: '13px 26px' }}>
                List Your Store
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ padding: 'clamp(56px, 8vw, 96px) clamp(20px, 6vw, 56px) 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span className="eyebrow">How it works</span>
          <h2 className="brand-heading" style={{ fontSize: 'var(--text-2xl)', marginTop: '10px' }}>
            Two different journeys, one real platform
          </h2>
          <p style={{ maxWidth: 560, margin: '14px auto 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', opacity: 0.75, lineHeight: 1.6 }}>
            A shopper never touches a catalog. A merchant never talks to an agent directly. Here's what each side actually does.
          </p>
        </div>

        <div
          className="landing-features-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', maxWidth: 980, margin: '0 auto' }}
        >
          <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>For Shoppers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {SHOPPER_STEPS.map((s) => (
                <StepRow key={s.step} {...s} />
              ))}
            </div>
          </Card>

          <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>For Merchants</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {MERCHANT_STEPS.map((s) => (
                <StepRow key={s.step} {...s} />
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="features" style={{ padding: 'clamp(56px, 8vw, 96px) clamp(20px, 6vw, 56px)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <span className="eyebrow">What Payzorray does</span>
          <h2 className="brand-heading" style={{ fontSize: 'var(--text-2xl)', marginTop: '10px' }}>
            One platform, two sides of the same trade
          </h2>
        </div>

        <div
          className="landing-features-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', maxWidth: 980, margin: '0 auto' }}
        >
          <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>For Shoppers</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {SHOPPER_FEATURES.map((f) => (
                <FeatureRow key={f.title} {...f} />
              ))}
            </div>
          </Card>

          <Card variant="soft" style={{ padding: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>For Merchants</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {MERCHANT_FEATURES.map((f) => (
                <FeatureRow key={f.title} {...f} />
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section id="get-started" style={{ padding: '0 clamp(20px, 6vw, 56px) clamp(56px, 8vw, 96px)' }}>
        <Card
          variant="loud"
          style={{
            maxWidth: 980,
            margin: '0 auto',
            padding: 'clamp(28px, 5vw, 48px)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px'
          }}
        >
          <h2 className="brand-heading" style={{ fontSize: 'var(--text-2xl)', margin: 0 }}>
            Ready to put your store in front of AI shoppers?
          </h2>
          <p style={{ margin: 0, maxWidth: 480, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', opacity: 0.75, lineHeight: 1.6 }}>
            List your catalog and get found the same day, or let an AI agent do your shopping for you -- either way, you're on the same real platform.
          </p>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/pick" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ padding: '13px 26px' }}>
                List Your Store
              </Button>
            </Link>
            <a href={BUYER_APP_URL} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" style={{ padding: '13px 26px' }}>
                Shop with AI
              </Button>
            </a>
          </div>
        </Card>
      </section>

      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(2, 10, 28, 0.72)',
          backdropFilter: 'blur(10px)',
          padding: 'var(--space-5) clamp(20px, 6vw, 56px) var(--space-4)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 'var(--space-5)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 280 }}>
          <img src="/payzorray-logo.png" alt="Payzorray" style={{ height: 48, width: 'auto' }} />
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', opacity: 0.85, lineHeight: 1.6 }}>
            The marketplace where AI shopping agents and real merchants transact directly.
          </p>
        </div>

        {/* Fixed-width: flexbox was squeezing columns onto one line */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-5)' }}>
          <div style={{ minWidth: 140, flexShrink: 0 }}>
            <p className="page-eyebrow" style={{ marginBottom: '12px', opacity: 1 }}>Product</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <a href="#how-it-works" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', opacity: 0.9, fontSize: 'var(--text-xs)' }}>How it works</a>
              <a href="#features" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', opacity: 0.9, fontSize: 'var(--text-xs)' }}>Features</a>
              <a href={BUYER_APP_URL} style={{ textDecoration: 'none', color: 'var(--color-text-muted)', opacity: 0.9, fontSize: 'var(--text-xs)' }}>Shop with AI</a>
            </div>
          </div>
          <div style={{ minWidth: 140, flexShrink: 0 }}>
            <p className="page-eyebrow" style={{ marginBottom: '12px', opacity: 1 }}>Merchants</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <Link to="/pick" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', opacity: 0.9, fontSize: 'var(--text-xs)' }}>List your store</Link>
              <a href="#get-started" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', opacity: 0.9, fontSize: 'var(--text-xs)' }}>Get started</a>
            </div>
          </div>
        </div>
      </footer>

      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(2, 10, 28, 0.72)',
          backdropFilter: 'blur(10px)',
          padding: 'var(--space-2) clamp(20px, 6vw, 56px) var(--space-3)',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', opacity: 0.75 }}>Yap. Shop. Done.</span>
      </div>
    </main>
  );
}
