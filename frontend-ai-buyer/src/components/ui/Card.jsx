export default function Card({ children, style, className = '', variant = 'soft', ...props }) {
  const variantClass = variant === 'loud' ? 'glass-strong' : 'glass';
  return (
    <div
      className={`${variantClass} ${className}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-2)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
