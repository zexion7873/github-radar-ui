import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./lib/csp";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next ignores stray parent lockfiles
  // (~/package-lock.json, ~/Project/package-lock.json) when inferring it.
  turbopack: {
    root: __dirname,
  },
  // The per-request Content-Security-Policy is proxy.ts's: it needs a nonce.
  async headers() {
    return [{ source: "/(.*)", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
