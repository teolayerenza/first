export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <rect width="64" height="64" rx="16" fill="url(#lg)" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path d="M8 46 L22 26 L30 36 L40 20 L56 46 Z" fill="#0b1b3a" opacity="0.85" />
      <path d="M10 50 C22 42 30 52 40 44 S54 40 56 36" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 7" />
    </svg>
  );
}
