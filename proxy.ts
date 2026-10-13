import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthed } from "@/lib/auth";

export function proxy(request: NextRequest) {
  if (isAuthed(request.cookies.get("gh_radar")?.value)) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Only /loot is gated. Server Actions POST to their own route, so
  // app/loot/actions.ts must check the session too.
  matcher: ["/loot/:path*"],
};
