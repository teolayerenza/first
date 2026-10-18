import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabase.replace(/^https:/, "wss:");
const tiles = "https://tiles.openfreemap.org";
const turnstile = "https://challenges.cloudflare.com";

// docs/SEGURIDAD.md §5. 'unsafe-inline' en scripts: lo necesitan el script de tema y el runtime de Next
// sin nonces; como no hay texto libre de usuarios en ninguna página, no hay vector de XSS que lo explote.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} ${tiles}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabase} ${supabaseWs} ${tiles} ${turnstile}`,
  `frame-src ${turnstile}`,
  "worker-src 'self' blob:",
  "child-src blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
