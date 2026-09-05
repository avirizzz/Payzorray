// Hand-rolled icons, not a library -- avoids default LLM look.
function base(size, strokeWidth) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
}

export function ChatIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-4.7 7.6 8.5 8.5 0 0 1-9.8-1.7L3 21l1.9-3.9a8.38 8.38 0 0 1-1.4-4.6 8.5 8.5 0 0 1 8.5-8.5h.5a8.48 8.48 0 0 1 8.5 8.5z" />
    </svg>
  );
}

export function ProfileIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.5 20c0-3.5 3.4-6 7.5-6s7.5 2.5 7.5 6" />
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

export function CloseIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 2)} {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon({ size = 12, ...props }) {
  return (
    <svg {...base(size, 3)} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5 5-5" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 18, ...props }) {
  return (
    <svg {...base(size, 2.25)} {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function PlusIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 2.25)} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 2.25)} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ size = 15, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  );
}

export function PencilIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function MapPinIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function GlobeIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 12, ...props }) {
  return (
    <svg {...base(size, 2)} {...props}>
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
      <path d="M18 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function DownloadIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 1.9)} {...props}>
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
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

export function CopyIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 2.1)} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ThumbsUpIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 2.1)} {...props}>
      <path d="M7 10v11" />
      <path d="M15 5.5 14 10h6.3a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.6a2 2 0 0 0 1.8-1.1L12 2a3 3 0 0 1 3 3.5Z" />
    </svg>
  );
}

export function ThumbsDownIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 2.1)} {...props}>
      <path d="M17 14V3" />
      <path d="M9 18.5 10 14H3.7a2 2 0 0 1-1.9-2.6l2.3-8A2 2 0 0 1 6 2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.6a2 2 0 0 0-1.8 1.1L12 22a3 3 0 0 1-3-3.5Z" />
    </svg>
  );
}

export function CartIcon({ size = 16, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="9" cy="21" r="1.4" />
      <circle cx="18" cy="21" r="1.4" />
      <path d="M2.5 3h2.4l1.9 11.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6.2" />
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

export function InfoIcon({ size = 15, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8v.01" />
    </svg>
  );
}

export function LockIcon({ size = 14, ...props }) {
  return (
    <svg {...base(size, 1.75)} {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </svg>
  );
}
