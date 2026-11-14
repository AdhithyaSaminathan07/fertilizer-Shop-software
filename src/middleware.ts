import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "kasi_session";

// Public routes that do not require authentication
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
const MUTATING_METHODS = ["POST", "PATCH", "DELETE", "PUT"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // 1. Enforce CSRF & Cross-Origin validation for all mutating API requests
  if (pathname.startsWith("/api/") && MUTATING_METHODS.includes(method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");

    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json(
            {
              success: false,
              error: "Forbidden: Cross-origin request blocked (CSRF validation failed).",
              timestamp: new Date().toISOString(),
            },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: Malformed Origin header.",
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
    }
  }

  // 2. Allow static files, Next.js internal assets, and explicit public routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // If user is already authenticated and visits /login, redirect to dashboard
  if (pathname === "/login") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // If user is unauthenticated on protected routes
  if (!sessionCookie) {
    // Return 401 for API routes
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Authentication is required to access this resource.",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Redirect to login for UI pages
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

