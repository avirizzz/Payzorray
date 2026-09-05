import ProductImage from '../ui/ProductImage';
import { CloseIcon } from '../ui/icons';

// Centralized to avoid drift; recolored from a reference design.
export const RECEIPT = {
  text: '#012652',
  textMuted: 'rgba(1,38,82,0.62)',
  panelBg: 'rgba(13,148,251,0.06)',
  panelBorder: 'rgba(1,38,82,0.1)',
  divider: 'rgba(1,38,82,0.12)',
  thumbBg: '#eef2f7'
};

export function LightCard({ title, badge, onClose, footer, children, maxWidth = '440px' }) {
  return (
    <div style={{ width: '100%', maxWidth, borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(1,38,82,0.15)', boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
      <div style={{ padding: '15px 18px', background: 'var(--color-blue)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {badge && (
              <span style={{ background: 'rgba(255,255,255,0.24)', color: '#ffffff', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap' }}>
                {badge}
              </span>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="press-on-active"
                style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.22)', border: 'none', borderRadius: '50%', color: '#ffffff', flexShrink: 0 }}
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '18px', color: RECEIPT.text }}>{children}</div>

      {footer && <div style={{ padding: '14px 18px', background: RECEIPT.panelBg, borderTop: `1px solid ${RECEIPT.panelBorder}` }}>{footer}</div>}
    </div>
  );
}

export function MetaField({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: '0.7rem', fontWeight: 600, color: RECEIPT.textMuted }}>{label}</dt>
      <dd style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</dd>
    </div>
  );
}

export function Panel({ title, children, style }) {
  return (
    <div style={{ background: RECEIPT.panelBg, border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: 'var(--radius)', padding: '14px', ...style }}>
      {title && <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '12px' }}>{title}</p>}
      {children}
    </div>
  );
}

export function ItemRow({ src, alt, name, meta, price, first, right }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 0', borderTop: first ? 'none' : `1px solid ${RECEIPT.divider}` }}>
      <div style={{ width: '52px', height: '52px', flexShrink: 0, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: RECEIPT.thumbBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ProductImage src={src} alt={alt} style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: RECEIPT.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        {meta && <p style={{ fontSize: '0.72rem', color: RECEIPT.textMuted, marginTop: '3px' }}>{meta}</p>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p className="gauge-number" style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: RECEIPT.text }}>{price}</p>
        {right}
      </div>
    </div>
  );
}

export function SummaryRow({ label, value, strong, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: strong ? '10px' : 0, borderTop: strong ? `1px solid ${RECEIPT.divider}` : 'none', marginTop: strong ? '2px' : 0 }}>
      <span style={{ fontSize: strong ? 'var(--text-sm)' : '0.8rem', fontWeight: strong ? 700 : 500, color: strong ? RECEIPT.text : RECEIPT.textMuted }}>{label}</span>
      <span className="gauge-number" style={{ fontSize: strong ? 'var(--text-sm)' : '0.8rem', fontWeight: 700, color: accent ? 'var(--color-blue)' : RECEIPT.text }}>{value}</span>
    </div>
  );
}

// Shared Button.jsx forces white text; illegible on light backgrounds.
export function LightButton({ variant = 'primary', children, style, ...props }) {
  const variants = {
    primary: { background: 'var(--color-blue)', color: '#ffffff', border: 'none' },
    ghost: { background: 'transparent', color: RECEIPT.text, border: `1.5px solid ${RECEIPT.panelBorder}` }
  };
  return (
    <button
      type="button"
      className="press-on-active"
      style={{
        borderRadius: 'var(--radius)',
        padding: '10px 18px',
        fontWeight: 700,
        fontSize: '0.85rem',
        fontFamily: 'var(--font-display)',
        ...variants[variant],
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}
