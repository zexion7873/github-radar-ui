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
  // Gate ONLY the loot routes — the rest of the radar (dashboard, trending, blog)
  // is public. `/loot/:path*` covers /loot/claude, /loot/copilot, and their detail
  // pages. Server Actions POST to their own route, so the write-back actions ALSO
  // verify the session — see app/loot/actions.ts.
  matcher: ["/loot/:path*"],
};
