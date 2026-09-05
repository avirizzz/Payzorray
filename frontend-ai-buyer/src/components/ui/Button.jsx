const VARIANTS = {
  primary: { background: 'var(--gradient-accent)', color: '#ffffff', border: '1px solid transparent' },
  secondary: { background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid var(--glass-border-strong)' },
  ghost: { background: 'transparent', color: '#ffffff', border: '1px solid var(--glass-border-strong)' }
};

export default function Button({ variant = 'primary', children, style, ...props }) {
  return (
    <button
      className="press-on-active"
      style={{
        borderRadius: 'var(--radius)',
        padding: '11px 20px',
        fontWeight: 700,
        fontSize: '0.9rem',
        fontFamily: 'var(--font-display)',
        letterSpacing: '0.01em',
        transition: `transform var(--transition-fast), opacity var(--transition-fast), background var(--transition-fast)`,
        ...VARIANTS[variant],
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}
