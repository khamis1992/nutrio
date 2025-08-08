import { NextResponse } from "next/server";

export function middleware() {
  // Placeholder for auth edge checks if needed later
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/restaurant/:path*", "/gym/:path*", "/driver/:path*"],
};
