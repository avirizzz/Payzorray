import ProductThumb from '../ui/ProductThumb';
import { CloseIcon } from '../ui/icons';

export default function AttachmentCard({ attachment, onRemove, compact = false }) {
  const isOrder = attachment.kind === 'order';

  return (
    <div
      className="glass-card glass-card-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        maxWidth: compact ? '100%' : 420
      }}
    >
      <ProductThumb src={attachment.image} name={attachment.title} size={40} radius={5} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.75, marginBottom: '2px' }}>
          {isOrder ? 'Order' : 'Listing'}
        </div>
        <strong style={{ fontSize: 'var(--text-xs)', display: 'block', lineHeight: 1.3 }}>{attachment.title}</strong>
        <p className="gauge-number" style={{ margin: '2px 0 0', fontSize: '0.72rem', opacity: 0.8 }}>
          {attachment.subtitle}
        </p>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
          className="press-on-active"
          style={{
            all: 'unset',
            cursor: 'pointer',
            padding: '5px',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            opacity: 0.75,
            display: 'flex',
            flexShrink: 0
          }}
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
