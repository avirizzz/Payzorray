import { useRef, useState } from 'react';
import { ArrowUpIcon, MapPinIcon } from '../ui/icons';
import { SLASH_COMMANDS } from '../../hooks/useAiBuyerConversation';

// Slash commands work in any flow step; checked first.
export default function ChatInput({ onSend, disabled, placeholder, suggestions }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  }

  function pickSuggestion(label) {
    setValue(label);
    inputRef.current?.focus();
  }

  const showingCommands = value.startsWith('/');
  const matchingCommands = showingCommands ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(value.toLowerCase())) : [];

  return (
    <div>
      {showingCommands ? (
        matchingCommands.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', paddingLeft: '4px' }}>
            {matchingCommands.map((c) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => pickSuggestion(c.cmd)}
                className="glass press-on-active"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: 'var(--radius)', padding: '6px 12px', color: '#ffffff', fontSize: 'var(--text-xs)', fontWeight: 600 }}
              >
                <span className="gauge-number" style={{ color: 'var(--color-blue)' }}>{c.cmd}</span>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{c.desc}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        suggestions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', paddingLeft: '4px' }}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSuggestion(s.label)}
                className="glass press-on-active"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', borderRadius: 'var(--radius)', padding: '6px 12px 6px 10px', color: '#ffffff', fontSize: 'var(--text-xs)', fontWeight: 600 }}
              >
                <MapPinIcon size={11} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />
                {s.label}
              </button>
            ))}
          </div>
        )
      )}
      <form
        onSubmit={handleSubmit}
        className="glass-strong"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 10px 10px 18px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.28)'
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={disabled ? 'Use the panel above to continue…' : placeholder || 'Ask me anything, or type / for commands…'}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: '#ffffff'
          }}
        />
        <button
          type="submit"
          disabled={disabled}
          aria-label="Send"
          className="press-on-active"
          style={{
            width: '38px',
            height: '38px',
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--gradient-accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ArrowUpIcon size={17} />
        </button>
      </form>
    </div>
  );
}
