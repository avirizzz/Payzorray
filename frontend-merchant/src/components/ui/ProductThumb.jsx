import { useState } from 'react';
import { resolveImageUrl } from '../../api/client';

// Falls back to the product's initial, never an empty hole.
export default function ProductThumb({ src, name, size = 56, radius = 10 }) {
  const [failed, setFailed] = useState(false);
  const url = src ? resolveImageUrl(src) : null;

  const box = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: radius,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.28)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  if (!url || failed) {
    return (
      <div style={box} aria-hidden="true">
        <span style={{ fontWeight: 800, fontSize: size * 0.36, color: '#fff', opacity: 0.85 }}>
          {(name || '?').trim().charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div style={box}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
