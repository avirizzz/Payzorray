import { useEffect, useMemo, useRef, useState } from 'react';

const WORD_MS = 55;

// Runs once per message; WeakSet tracks already-streamed to skip replay.
export default function StreamingText({ text, message, streamed, onDone }) {
  const words = useMemo(() => text.split(' '), [text]);
  const [count, setCount] = useState(() => (streamed?.has(message) ? words.length : 0));
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (streamed?.has(message)) {
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onDone?.();
      }
      return;
    }
    if (count >= words.length) {
      streamed?.add(message);
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onDone?.();
      }
      return;
    }
    const t = setTimeout(() => setCount((c) => c + 1), WORD_MS);
    return () => clearTimeout(t);
  }, [count, words.length, message, streamed, onDone]);

  const done = count >= words.length;

  return (
    <>
      {words.slice(0, count).map((word, i) => (
        <span key={i} style={{ animation: 'stream-word-in 220ms ease-out both' }}>
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
      {!done && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '2px',
            height: '0.9em',
            marginLeft: '2px',
            verticalAlign: '-0.1em',
            background: 'currentColor',
            animation: 'stream-cursor-blink 0.9s step-end infinite'
          }}
        />
      )}
    </>
  );
}
