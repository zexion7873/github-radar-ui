import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next ignores stray parent lockfiles
  // (~/package-lock.json, ~/Project/package-lock.json) when inferring it.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
