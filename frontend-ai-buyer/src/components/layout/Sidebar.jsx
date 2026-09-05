import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getProfile, AI_BUYER_PERSONA_ID } from '../../api/profile';
import { ChatIcon, ProfileIcon, OrdersIcon } from '../ui/icons';

const NAV = [
  { to: '/', label: 'Chat', Icon: ChatIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
  { to: '/orders', label: 'Orders', Icon: OrdersIcon }
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getProfile(AI_BUYER_PERSONA_ID)
      .then(setProfile)
      .catch(() => {});
  }, []);

  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-3) var(--space-2)',
        borderRight: '1px solid var(--glass-border)',
        background: 'rgba(1, 10, 26, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <div style={{ padding: '0 8px', marginBottom: 'var(--space-4)' }}>
        <img src="/buyer-logo.png" alt="Buyer" style={{ width: '150px', height: 'auto', display: 'block' }} />
      </div>

      <p className="eyebrow" style={{ padding: '0 8px', marginBottom: '10px' }}>Menu</p>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '11px',
                padding: '10px 10px 10px 13px',
                borderRadius: 'var(--radius)',
                textDecoration: 'none',
                color: active ? '#fff' : 'var(--color-text-muted)',
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'background var(--transition-fast), color var(--transition-fast)'
              }}
            >
              {active && (
                <span style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', borderRadius: '2px', background: 'var(--gradient-accent)' }} />
              )}
              <item.Icon size={17} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.04)' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {profile.name?.[0] || 'A'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</p>
            <p style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.email}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
