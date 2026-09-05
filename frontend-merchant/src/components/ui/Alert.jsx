import { AlertIcon } from './icons';

export default function Alert({ title, children, variant = 'default', style, ...props }) {
  const destructive = variant === 'destructive';
  return (
    <div
      className="glass-card"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        padding: 'var(--space-2) var(--space-3)',
        borderColor: destructive ? 'rgba(255, 107, 107, 0.5)' : undefined,
        ...style
      }}
      {...props}
    >
      <span style={{ color: destructive ? 'var(--color-danger)' : 'var(--color-accent)', flexShrink: 0, marginTop: '2px' }}>
        <AlertIcon size={18} />
      </span>
      <div>
        {title && <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>{title}</p>}
        <div style={{ marginTop: title ? '2px' : 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', opacity: 0.9 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
