// Íconos propios en SVG (trazo 2px, 24x24).
const P: Record<string, React.ReactNode> = {
  play: <path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M5 5.5v13a.8.8 0 0 0 1.25.66l9.5-6.5a.8.8 0 0 0 0-1.32l-9.5-6.5A.8.8 0 0 0 5 5.5Z" fill="currentColor" stroke="none" />
      <rect x="17" y="5" width="2.6" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M19 5.5v13a.8.8 0 0 1-1.25.66l-9.5-6.5a.8.8 0 0 1 0-1.32l9.5-6.5A.8.8 0 0 1 19 5.5Z" fill="currentColor" stroke="none" />
      <rect x="4.4" y="5" width="2.6" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  shuffle: <path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 3.8C14.3 15 15.5 17 17.5 17H21m0 0-2.5-2.5M21 17l-2.5 2.5M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M21 7h-3.5c-1.4 0-2.4.5-3.2 1.4M21 7l-2.5-2.5M21 7l-2.5 2.5" />,
  repeat: <path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1" />,
  heart: <path d="M12 20.3s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.8 2.7c0 5.6-7.8 10.3-7.8 10.3Z" />,
  heartFill: <path d="M12 20.3s-7.8-4.7-7.8-10.3A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.8 2.7c0 5.6-7.8 10.3-7.8 10.3Z" fill="currentColor" />,
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />,
  homeFill: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" fill="currentColor" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  library: <path d="M5 4v16M10 4v16M14.5 4.8l4.6 14.4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  queue: <path d="M4 6h16M4 11h10M4 16h7M16.5 14v6l4.5-3-4.5-3Z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  friends: (
    <>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5M16 5.2a3.2 3.2 0 0 1 0 5.8M18 14.6c1.6.6 2.7 2.2 3 4.9" />
    </>
  ),
  volume: <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  volumeLow: <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5ZM15.5 9a4 4 0 0 1 0 6" />,
  mute: <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5ZM16 9.5l5 5M21 9.5l-5 5" />,
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  verified: (
    <>
      <path d="M12 2.8 14.3 5l3.1-.4.6 3.1 2.8 1.5-1.3 2.8 1.3 2.8-2.8 1.5-.6 3.1-3.1-.4L12 21.2 9.7 19l-3.1.4-.6-3.1-2.8-1.5L4.5 12 3.2 9.2 6 7.7l.6-3.1 3.1.4L12 2.8Z" fill="currentColor" stroke="none" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.8" stroke="var(--verified-ink, #fff)" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.8-3.8 3.7-5.8 7.5-5.8s6.7 2 7.5 5.8" />
    </>
  ),
  share: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />,
  back: <path d="M15 5l-7 7 7 7" />,
  fwd: <path d="M9 5l7 7-7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  music: (
    <>
      <path d="M9 18V5.5l10-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5Z" />
    </>
  ),
  drag: <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="3" />,
  logout: <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12H9" />,
  addQueue: <path d="M4 6h12M4 11h12M4 16h7M18 13v7M14.5 16.5h7" />,
  playNext: <path d="M4 6h12M4 11h8M4 16h8M15 13v7l5.5-3.5L15 13Z" />,
  addList: <path d="M4 6h12M4 11h12M4 16h7M17 13v7M13.5 16.5h7" />,
  artist: (
    <>
      <circle cx="10" cy="8" r="3.8" />
      <path d="M3 20c.7-3.6 3.4-5.6 7-5.6 1.2 0 2.3.2 3.2.6M17.5 13v6.2M17.5 19.2a1.8 1.8 0 1 1-1.8-1.8M17.5 13l3 1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  up: <path d="M5 15l7-7 7 7" />,
};

export function Icon({ name, size = 20, className, title }: { name: keyof typeof P | string; size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}

/** Logo: una onda que sube como un vúmetro. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <g fill="var(--accent-ink)">
        <rect x="7" y="14" width="3.2" height="9" rx="1.6" />
        <rect x="12.4" y="9" width="3.2" height="14" rx="1.6" />
        <rect x="17.8" y="12" width="3.2" height="11" rx="1.6" />
        <rect x="23.2" y="7" width="3.2" height="16" rx="1.6" />
      </g>
    </svg>
  );
}

export function Eq({ playing = true }: { playing?: boolean }) {
  return (
    <span className={"eq" + (playing ? " on" : "")} aria-label="Sonando">
      <i />
      <i />
      <i />
    </span>
  );
}
