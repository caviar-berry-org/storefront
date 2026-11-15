import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, localizedPath, preferredLocale } from "./i18n/routing";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.pathname === "/") {
    url.pathname = localizedPath(
      preferredLocale(request.headers.get("accept-language")),
    );
    const response = NextResponse.redirect(url);
    response.headers.set("Vary", "Accept-Language");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  url.pathname = localizedPath(defaultLocale, url.pathname);
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/", "/products/:path*", "/privacy", "/terms", "/offer"],
};
