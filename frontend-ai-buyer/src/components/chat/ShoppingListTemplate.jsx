import { useEffect, useRef, useState } from 'react';
import { PlusIcon, MinusIcon, TrashIcon } from '../ui/icons';
import { LightCard, LightButton, RECEIPT } from './LightCard';

const PLACEHOLDERS = ['e.g. onions', 'e.g. toothpaste', 'e.g. milk', 'e.g. bread', 'e.g. dish soap', 'e.g. bananas'];
const BLANK_ROWS = () => [{ text: '', quantity: 1 }, { text: '', quantity: 1 }, { text: '', quantity: 1 }, { text: '', quantity: 1 }];

// Reopens the active draft list instead of a blank one.
export default function ShoppingListTemplate({ open, onClose, onSubmit, initialItems }) {
  const [items, setItems] = useState(BLANK_ROWS);
  const [focusIndex, setFocusIndex] = useState(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (open) {
      setItems(initialItems?.length ? initialItems.map((i) => ({ ...i })) : BLANK_ROWS());
      setFocusIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (focusIndex == null) return;
    const el = inputRefs.current[focusIndex];
    if (el) el.focus();
    setFocusIndex(null);
  }, [focusIndex, items.length]);

  if (!open) return null;

  const filledCount = items.filter((i) => i.text.trim()).length;

  function updateText(i, value) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, text: value } : it)));
  }

  function updateQuantity(i, delta) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it)));
  }

  function addRow(focusNew) {
    setItems((prev) => [...prev, { text: '', quantity: 1 }]);
    if (focusNew) setFocusIndex(items.length);
  }

  function removeRow(i) {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, j) => j !== i));
  }

  function handleKeyDown(e, i) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i === items.length - 1) addRow(true);
    else inputRefs.current[i + 1]?.focus();
  }

  function handleSubmit() {
    if (filledCount === 0) return;
    onSubmit(items);
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(1,38,82,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 'var(--space-2)' }}
    >
      <style>{`
        .slt-input { transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
        .slt-input:focus { border-color: var(--color-blue) !important; box-shadow: 0 0 0 3px rgba(13,148,251,0.16); }
        .slt-remove:hover:not(:disabled) { background: rgba(214,69,69,0.1) !important; color: #d64545 !important; }
        .slt-add:hover { background: rgba(13,148,251,0.08); border-color: var(--color-blue); }
      `}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)' }}>
        <LightCard
          title="Shopping List"
          badge={filledCount > 0 ? `${filledCount} item${filledCount > 1 ? 's' : ''}` : null}
          onClose={onClose}
          maxWidth="480px"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <LightButton variant="ghost" onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </LightButton>
              <LightButton variant="primary" onClick={handleSubmit} disabled={filledCount === 0} style={{ flex: 1 }}>
                {filledCount > 0 ? `Search ${filledCount} item${filledCount > 1 ? 's' : ''}` : 'Search these items'}
              </LightButton>
            </div>
          }
        >
          <p style={{ fontSize: 'var(--text-sm)', color: RECEIPT.textMuted, marginBottom: '18px' }}>
            One item per line. I'll find real matches for each, then you pick the exact one before anything's added.
          </p>

          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: RECEIPT.text, marginBottom: '10px' }}>Your Items ({items.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  aria-hidden="true"
                  className="gauge-number"
                  style={{
                    width: '22px',
                    height: '22px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: `1px solid ${RECEIPT.panelBorder}`,
                    background: item.text.trim() ? 'rgba(13,148,251,0.12)' : 'transparent',
                    color: item.text.trim() ? 'var(--color-blue)' : RECEIPT.textMuted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}
                >
                  {i + 1}
                </span>
                <input
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  value={item.text}
                  onChange={(e) => updateText(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  placeholder={PLACEHOLDERS[i % PLACEHOLDERS.length]}
                  className="slt-input"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: `1px solid ${RECEIPT.panelBorder}`,
                    borderRadius: 'var(--radius)',
                    padding: '9px 12px',
                    background: '#ffffff',
                    color: RECEIPT.text,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-body)',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0, border: `1px solid ${RECEIPT.panelBorder}`, borderRadius: 'var(--radius-pill)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => updateQuantity(i, -1)}
                    disabled={item.quantity <= 1}
                    aria-label="Decrease quantity"
                    className="press-on-active"
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: item.quantity <= 1 ? RECEIPT.textMuted : RECEIPT.text, opacity: item.quantity <= 1 ? 0.4 : 1, borderRadius: '50%', cursor: item.quantity <= 1 ? 'default' : 'pointer' }}
                  >
                    <MinusIcon size={9} />
                  </button>
                  <span className="gauge-number" style={{ minWidth: '16px', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: RECEIPT.text }}>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(i, 1)}
                    aria-label="Increase quantity"
                    className="press-on-active"
                    style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: RECEIPT.text, borderRadius: '50%', cursor: 'pointer' }}
                  >
                    <PlusIcon size={9} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                  className="slt-remove press-on-active"
                  style={{
                    width: '28px',
                    height: '28px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    color: items.length === 1 ? RECEIPT.textMuted : RECEIPT.text,
                    opacity: items.length === 1 ? 0.35 : 0.7,
                    cursor: items.length === 1 ? 'default' : 'pointer'
                  }}
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => addRow(false)}
            className="slt-add press-on-active"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '9px',
              borderRadius: 'var(--radius)',
              border: `1.5px dashed ${RECEIPT.panelBorder}`,
              background: 'transparent',
              color: RECEIPT.textMuted,
              fontSize: 'var(--text-xs)',
              fontWeight: 700
            }}
          >
            <PlusIcon size={12} />
            Add another item
          </button>
        </LightCard>
      </div>
    </div>
  );
}
