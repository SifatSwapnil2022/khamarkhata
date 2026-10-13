import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate: no session cookie → straight to /login with a return path.
 * The real check (valid, unexpired session; farm membership; permission) happens on the server per request.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has("kk_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/onboarding", "/invites"] };
