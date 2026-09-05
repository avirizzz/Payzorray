export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <div style={{ width: '30px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: 'var(--color-blue)',
                animation: 'typing-bounce 1.2s infinite',
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Thinking…</span>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
