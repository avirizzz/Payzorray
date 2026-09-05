export function BarSeries({ data, valueKey = 'revenue', prefix = '₹', height = 140 }) {
  const max = Math.max(...data.map((d) => d[valueKey]), 0);
  if (!max) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.75 }}>
        No revenue recorded in this window.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height, marginBottom: '6px' }}>
        {data.map((d) => {
          const pct = (d[valueKey] / max) * 100;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${prefix}${d[valueKey]} (${d.orders} orders)`}
              style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', minWidth: 0 }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(pct, d[valueKey] > 0 ? 2 : 0)}%`,
                  background: d[valueKey] > 0 ? 'rgba(255,255,255,0.9)' : 'transparent',
                  borderRadius: '2px 2px 0 0',
                  borderBottom: d[valueKey] > 0 ? 'none' : '1px solid rgba(255,255,255,0.2)'
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.75 }}>
        <span className="gauge-number">{data[0]?.date}</span>
        <span className="gauge-number">peak {prefix}{max}</span>
        <span className="gauge-number">{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function RankedBars({ rows, valueKey = 'revenue', prefix = '₹', max: maxOverride }) {
  if (!rows?.length) {
    return <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.75 }}>Nothing recorded yet.</p>;
  }
  const max = maxOverride || Math.max(...rows.map((r) => r[valueKey]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {rows.map((r) => (
        <div key={r.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '3px' }}>
            <span style={{ fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </span>
            <span className="gauge-number" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {prefix}
              {r[valueKey]}
            </span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.16)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(r[valueKey] / max) * 100}%`, height: '100%', background: 'rgba(255,255,255,0.9)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, centerLabel, centerValue, size = 132 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;

  if (!total) {
    return <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.75 }}>Nothing recorded yet.</p>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
        <g transform="rotate(-90 66 66)">
          <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="14" />
          {segments.map((s) => {
            if (!s.value) return null;
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx="66"
                cy="66"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="66" y="62" textAnchor="middle" fill="#fff" fontSize="21" fontWeight="800" fontFamily="var(--font-mono)">
          {centerValue}
        </text>
        <text x="66" y="79" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="9" letterSpacing="1.2">
          {centerLabel}
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-xs)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ opacity: 0.85 }}>{s.label}</span>
            <span className="gauge-number" style={{ fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
