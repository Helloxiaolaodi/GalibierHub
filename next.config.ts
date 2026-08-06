import type { NextConfig } from "next";

// ---- Content Security Policy ----
const ALLOWED_SCRIPT_SRCS = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "https://challenges.cloudflare.com",
  "https://cdn.jsdelivr.net",
];

const ALLOWED_CONNECT_SRCS = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.r2.dev",
  "https://huggingface.co",
  "https://hf-mirror.com",
  "https://challenges.cloudflare.com",
];

const ALLOWED_IMG_SRCS = [
  "'self'",
  "data:",
  "blob:",
  "https://*.supabase.co",
  "https://*.r2.dev",
  "https://huggingface.co",
];

const CSP = [
  "default-src 'self'",
  "script-src " + ALLOWED_SCRIPT_SRCS.join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src " + ALLOWED_IMG_SRCS.join(" "),
  "font-src 'self'",
  "connect-src " + ALLOWED_CONNECT_SRCS.join(" "),
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Do not externalize server-side packages used by API routes. OpenNext only
  // copies external packages with a "workerd" export condition, so listing
  // @supabase/supabase-js here would remove it from the Cloudflare bundle.
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
