import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Post-login router: send each account type to its own surface. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", origin));

  const [{ data: memberships }, { data: customerAccounts }] = await Promise.all([
    supabase.from("memberships").select("company_id, role").eq("user_id", user.id).eq("active", true),
    supabase.from("customer_accounts").select("id").eq("user_id", user.id).limit(1),
  ]);

  if (memberships && memberships.length > 0) {
    if (memberships.length > 1) {
      return NextResponse.redirect(new URL("/auth/choose-company", origin));
    }
    const dest = memberships[0].role === "bo" ? "/bo/pipeline" : "/worker/jobs";
    const res = NextResponse.redirect(new URL(dest, origin));
    res.cookies.set("active-company", memberships[0].company_id, { path: "/", sameSite: "lax" });
    return res;
  }

  if (customerAccounts && customerAccounts.length > 0) {
    return NextResponse.redirect(new URL("/portal", origin));
  }

  // Authenticated but attached to nothing: an OAuth user who hasn't
  // finished company signup yet.
  return NextResponse.redirect(new URL("/auth/signup/complete", origin));
}
