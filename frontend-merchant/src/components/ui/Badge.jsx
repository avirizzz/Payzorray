export default function Badge({ children, color, style, ...props }) {
  const background = color || 'var(--color-surface-raised)';
  return (
    <span
      style={{
        display: 'inline-block',
        background,
        border: '1.5px solid var(--color-border-strong)',
        borderRadius: '20px',
        padding: '3px 12px',
        fontWeight: 700,
        fontSize: 'var(--text-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        color: 'var(--color-text)',
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  );
}
