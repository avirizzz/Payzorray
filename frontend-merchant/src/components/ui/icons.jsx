function base(size, strokeWidth) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
}

export function HomeIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10" />
      <path d="M10 20.5V14h4v6.5" />
    </svg>
  );
}

export function OrdersIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M20.5 7.5 12 3 3.5 7.5 12 12l8.5-4.5Z" />
      <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
      <path d="M12 12v9" />
    </svg>
  );
}

export function CatalogIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ChatIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-4.7 7.6 8.5 8.5 0 0 1-9.8-1.7L3 21l1.9-3.9a8.38 8.38 0 0 1-1.4-4.6 8.5 8.5 0 0 1 8.5-8.5h.5a8.48 8.48 0 0 1 8.5 8.5z" />
    </svg>
  );
}

export function UpsellIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function SwitchIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M7 7h11l-3-3" />
      <path d="M17 17H6l3 3" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

export function AlertIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17.5v.01" />
    </svg>
  );
}

export function SparkleIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.6)} {...props} fill="currentColor" stroke="none">
      <path d="M12 2.5c.35 3.1 1.1 5.15 2.25 6.3S17.4 10.4 20.5 10.75c-3.1.35-5.15 1.1-6.3 2.25S12.35 15.9 12 19c-.35-3.1-1.1-5.15-2.25-6.3S6.6 11.1 3.5 10.75c3.1-.35 5.15-1.1 6.3-2.25S11.65 5.6 12 2.5Z" />
      <path d="M19 2.8c.15 1.1.4 1.85.85 2.3s1.2.7 2.3.85c-1.1.15-1.85.4-2.3.85s-.7 1.2-.85 2.3c-.15-1.1-.4-1.85-.85-2.3s-1.2-.7-2.3-.85c1.1-.15 1.85-.4 2.3-.85s.7-1.2.85-2.3Z" />
    </svg>
  );
}

export function LockIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}

export function CloseIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 2)} {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function SearchIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ChartIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M4 20V10" />
      <path d="M11 20V4" />
      <path d="M18 20v-7" />
    </svg>
  );
}
