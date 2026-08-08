import type { NextConfig } from "next";

// Baseline security headers. There was no next.config at all before this,
// so the app was shipping with none of Next's opt-in protections — no
// clickjacking protection, no MIME-sniffing protection, no CSP.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  // Prevents the app being framed by another site (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers guessing content-types away from what's declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full referrer URLs (which can contain item/user context) to
  // third-party origins when links are followed off-site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable APIs this app never needs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs 'unsafe-inline' for its hydration bootstrap scripts.
      // 'unsafe-eval' is required by React's dev-mode debugging tools (fast
      // refresh, stack reconstruction) — React never calls eval() in a
      // production build, so this is scoped to dev only.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // Supabase auth/storage + the public OSRS price API this app calls from the server.
      "connect-src 'self' https://*.supabase.co https://prices.runescape.wiki",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oldschool.runescape.wiki",
      },
      {
        protocol: "https",
        hostname: "*.runescape.wiki",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
