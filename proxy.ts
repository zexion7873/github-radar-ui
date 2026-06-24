import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Single-password gate: a valid session cookie holds AUTH_SECRET verbatim.
// If AUTH_SECRET is unset we fail SAFE (everything redirects to /login) — never
// open, since an unset secret would otherwise make undefined === undefined true.
export function proxy(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const authed = !!secret && request.cookies.get("gh_radar")?.value === secret;
  if (authed) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate every route except /login, Next internals, and files with an extension
  // (public assets, favicon). Server Actions POST to their own route, so the
  // write-back action must ALSO verify the session itself — see app/login/actions.ts.
  matcher: ["/((?!api|_next/static|_next/image|login|.*\\..*).*)"],
};
