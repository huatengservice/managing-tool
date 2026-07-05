import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Session refresh + route gating.
 *
 * BO/Worker areas require an aal2 session — 2FA is mandatory regardless of
 * auth method (spec §8). A session that authenticated but hasn't passed
 * TOTP is aal1 and gets bounced to verification (or enrollment if the user
 * has no factor yet). The customer portal requires only a session.
 *
 * This is a UX gate; the real enforcement stays in RLS and server checks.
 */

const STAFF_PREFIXES = ["/bo", "/worker"];
const AUTH_REQUIRED_PREFIXES = [...STAFF_PREFIXES, "/portal", "/auth/choose-company"];

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if needed (also enforces GoTrue's inactivity timeout).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = AUTH_REQUIRED_PREFIXES.some((p) => path.startsWith(p));
  const isStaffArea = STAFF_PREFIXES.some((p) => path.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (isStaffArea && user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeJwtPayload(session.access_token) : null;
    if (claims && claims.aal !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the payment webhook (signature-verified itself).
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-.*|api/webhooks).*)",
  ],
};
