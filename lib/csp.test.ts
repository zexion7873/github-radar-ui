import { describe, expect, it } from "vitest";
import { buildCsp, CSP_HEADER, STATIC_SECURITY_HEADERS } from "./csp";

const prod = buildCsp({ nonce: "abc123", dev: false, connect: ["https://rag.example"] });
const dev = buildCsp({ nonce: "abc123", dev: true, connect: ["http://localhost:8080"] });

function directive(csp: string, name: string): string | undefined {
  return csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

describe("buildCsp", () => {
  it("is one header line", () => {
    expect(prod).not.toMatch(/[\r\n]/);
    // Every directive is a name, then its values; upgrade-insecure-requests has none.
    expect(prod.split("; ").every((d) => /^[a-z-]+( |$)/.test(d))).toBe(true);
  });

  it("puts the nonce on scripts and styles, with strict-dynamic for what they load", () => {
    expect(directive(prod, "script-src")).toContain("'nonce-abc123'");
    expect(directive(prod, "script-src")).toContain("'strict-dynamic'");
    expect(directive(prod, "style-src")).toContain("'nonce-abc123'");
  });

  it("allows no inline or eval'd script in production", () => {
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(prod, "style-src")).not.toContain("'unsafe-inline'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("relaxes only what development needs", () => {
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "style-src")).toContain("'unsafe-inline'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("lets the page reach radar-rag and Vercel's collectors, and nothing else", () => {
    const connect = directive(prod, "connect-src");
    expect(connect).toBe(
      "'self' https://rag.example https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    );
  });

  it("frames only Turnstile and is framed by no one", () => {
    expect(directive(prod, "frame-src")).toBe("https://challenges.cloudflare.com");
    expect(directive(prod, "frame-ancestors")).toBe("'none'");
    expect(directive(prod, "object-src")).toBe("'none'");
    expect(directive(prod, "base-uri")).toBe("'self'");
    expect(directive(prod, "form-action")).toBe("'self'");
  });

  it("starts in report-only mode", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only");
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("denies framing and sniffing on every response", () => {
    const byKey = Object.fromEntries(STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value]));
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBeDefined();
    expect(byKey["Permissions-Policy"]).toBeDefined();
  });
});
