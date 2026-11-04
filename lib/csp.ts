// Not `server-only`: proxy.ts and next.config.ts import it outside the RSC graph.

// Report-Only first: the browser logs what an enforced policy would block and
// blocks nothing. proxy.ts switches the name to Content-Security-Policy once a
// round on the live site reports no violation that is ours.
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

// Sent on every response from next.config.ts, enforced from day one: none of
// them can break a page that works today.
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  // The site is never framed; frame-ancestors below says the same to browsers
  // that read CSP, this one to the rest.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// One policy per request, keyed on its nonce. Next puts the nonce on its own
// scripts and inline styles when it finds one in the request's CSP header
// (either name); 'strict-dynamic' then trusts what those scripts load, which is
// how next/script's Turnstile tag and Vercel's analytics script get in without
// a host allow-list that strict-dynamic would ignore anyway.
export function buildCsp({
  nonce,
  dev,
  connect,
}: {
  nonce: string;
  dev: boolean;
  /** Origins the browser may fetch besides the page's own: radar-rag's. */
  connect: string[];
}): string {
  const directives = [
    "default-src 'self'",
    // Dev only: React rebuilds server error stacks in the browser with eval.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    // Dev only: Turbopack injects styles inline during HMR.
    `style-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-inline'" : ""}`,
    // style="" attributes (StarsTrend's bar heights, the category mix's widths)
    // cannot carry a nonce and cannot run script.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Vercel Analytics and Speed Insights post to the site's own origin in
    // production and to these two hosts in development and on previews.
    `connect-src 'self' ${connect.join(" ")} https://va.vercel-scripts.com https://vitals.vercel-insights.com`,
    // The Turnstile widget is an iframe.
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
