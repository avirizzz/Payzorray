import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMerchant } from '../../context/MerchantContext';
import { HomeIcon, OrdersIcon, CatalogIcon, ChatIcon, UpsellIcon, SwitchIcon, ChartIcon, SparkleIcon } from '../ui/icons';

const NAV_ITEMS = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/stats', label: 'Stats', Icon: ChartIcon },
  { to: '/orders', label: 'Orders', Icon: OrdersIcon },
  { to: '/catalog', label: 'Catalog', Icon: CatalogIcon },
  { to: '/chat', label: 'Ask Your Store', Icon: ChatIcon },
  { to: '/campaigns', label: 'Campaigns', Icon: SparkleIcon },
  { to: '/upsell', label: 'Upsell', Icon: UpsellIcon }
];

export default function DashboardLayout({ children }) {
  const { merchantId, setMerchantId } = useMerchant();
  const navigate = useNavigate();

  useEffect(() => {
    if (!merchantId) navigate('/pick', { replace: true });
  }, [merchantId, navigate]);

  if (!merchantId) return null;

  function switchStore() {
    setMerchantId(null);
    navigate('/pick');
  }

  return (
    <div className="merchant-bg" style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          borderRight: '1px solid rgba(13, 148, 251, 0.15)',
          background: 'rgb(210, 228, 248)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-3) var(--space-2)',
          gap: 'var(--space-4)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 var(--space-1)' }}>
          <img src="/payzorray-logo.png" alt="Payzorray" style={{ height: 60, width: 'auto', alignSelf: 'flex-start' }} />
          <span className="brand-mono" style={{ fontSize: 'var(--text-sm)', color: '#0d94fb', lineHeight: 1.1 }}>
            for Merchants
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `merchant-nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 var(--space-1)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: '#5b7791', opacity: 0.9 }}>Viewing store</span>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#012652', wordBreak: 'break-word' }}>{merchantId}</span>
          <button
            onClick={switchStore}
            className="press-on-active"
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              color: '#0d94fb',
              fontWeight: 700,
              marginTop: '4px'
            }}
          >
            <SwitchIcon size={14} /> Switch store
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, height: '100%', padding: 'var(--space-4)', overflowY: 'auto' }}>{children}</main>
    </div>
  );
}
