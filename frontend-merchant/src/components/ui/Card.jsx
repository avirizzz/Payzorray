export default function Card({ children, style, className = '', variant = 'soft', dense = false, ...props }) {
  const classes = ['glass-card'];
  if (variant === 'loud') classes.push('glass-card-strong');
  if (dense) classes.push('glass-card-row');
  classes.push(className);
  return (
    <div
      className={classes.join(' ')}
      style={{
        padding: 'var(--space-2)',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}
