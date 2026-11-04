import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthed } from "@/lib/auth";
import { buildCsp, CSP_HEADER } from "@/lib/csp";
import { RADAR_RAG_URL } from "@/lib/config";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only /loot is gated. Server Actions POST to their own route, so
  // app/loot/actions.ts must check the session too.
  if (
    (pathname === "/loot" || pathname.startsWith("/loot/")) &&
    !isAuthed(request.cookies.get("gh_radar")?.value)
  ) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // A fresh nonce per page render. Next reads it from the request's CSP header
  // (the report-only name included) and puts it on its own scripts and inline
  // styles; app/layout.tsx reads x-nonce for the one inline script that is ours.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    connect: [new URL(RADAR_RAG_URL).origin],
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  // Every page, so every page gets its nonce; not the API route, Next's static
  // assets, the icons, or a prefetch, none of which renders HTML.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|opengraph-image.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
