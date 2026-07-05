import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) redirect target. Supabase's server-side code
 * exchange validates the PKCE flow (state/nonce — spec §15.13). New OAuth
 * users still need a phone number (primary identifier, spec §8), so anyone
 * without a profile is routed through /auth/complete-profile first.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/after";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile) {
          return NextResponse.redirect(
            new URL(`/auth/complete-profile?next=${encodeURIComponent(next)}`, url.origin)
          );
        }
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/auth/login?error=oauth", url.origin));
}
