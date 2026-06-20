import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/pitch", "/api", "/_next", "/favicon.ico"];
// Note: /api/agent/morning is hit by Vercel cron — public match above covers it.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const demoCookie = req.cookies.get("compass_demo_user")?.value;
  const supaCookie =
    req.cookies.get("sb-access-token")?.value ||
    [...req.cookies.getAll()].some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (!demoCookie && !supaCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
