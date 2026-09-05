export default function Badge({ children, color, style, ...props }) {
  const background = color || 'rgba(255,255,255,0.1)';
  return (
    <span
      style={{
        display: 'inline-block',
        background,
        border: '1px solid var(--glass-border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 10px',
        fontWeight: 700,
        fontSize: 'var(--text-xs)',
        letterSpacing: '0.02em',
        color: '#ffffff',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  );
}
