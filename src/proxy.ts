import { NextResponse, type NextRequest } from "next/server";
import { MOD_COOKIE, verifyToken } from "@/lib/auth";

// Protege el panel del moderador y su API. La vista de encuestados (/q, /api/play) queda abierta.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/mod/login") return NextResponse.next();
  if (await verifyToken(request.cookies.get(MOD_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return new Response("No autorizado", { status: 401 });
  const url = new URL("/mod/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/mod/:path*", "/mod", "/api/mod/:path*"],
};
