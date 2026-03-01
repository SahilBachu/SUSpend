import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  const path = request.nextUrl.pathname;
  const isPublicAsset = /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(path);

  // Paths that don't require authentication
  const publicPaths = [
    "/login",
    "/api/auth/login",
    "/_next",
    "/favicon.ico",
  ];
  if (isPublicAsset || publicPaths.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Not logged in -> redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { role } = payload as { role: string };

    // Admin routes
    if (path.startsWith("/admin") && role !== "admin") {
      // Employees trying to access admin dashboard
      return NextResponse.redirect(new URL("/employee/dashboard", request.url));
    }

    // Optional: Keep root generic or redirect admins to theirs
    if (path === "/" || path === "") {
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      } else {
        return NextResponse.redirect(
          new URL("/employee/dashboard", request.url),
        );
      }
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
