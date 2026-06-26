import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthed } from "@/lib/auth";

// Single-password gate: a valid session cookie holds AUTH_SECRET verbatim, checked
// constant-time in isAuthed (which also fails SAFE when AUTH_SECRET is unset).
export function proxy(request: NextRequest) {
  if (isAuthed(request.cookies.get("gh_radar")?.value)) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate every route except /login, Next internals, and genuine static assets.
  // The asset exclusion is an END-ANCHORED extension allowlist (…\.(ico|png|…)$),
  // NOT a bare "contains a dot" — so a future route path with a dot stays gated
  // instead of silently bypassing auth. Server Actions POST to their own route,
  // so the write-back actions ALSO verify the session — see app/loot/actions.ts.
  matcher: [
    "/((?!api|_next/static|_next/image|login|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|css|js|map|txt|woff2?|ttf)$).*)",
  ],
};
