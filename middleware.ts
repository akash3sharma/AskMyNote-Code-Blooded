import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/constants";

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/signup", "/auth/forgot"];
const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/signup", "/api/auth/forgot"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token && pathname.startsWith("/auth/")) {
      return NextResponse.redirect(new URL("/app", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/app") || pathname.startsWith("/api/subjects") || pathname.startsWith("/api/settings")) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
