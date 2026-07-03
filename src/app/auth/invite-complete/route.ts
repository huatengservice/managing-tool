import { NextResponse } from "next/server";
import { finalizeInviteAcceptance } from "@/app/auth/actions";

/** OAuth continuation of the worker-invite flow: redeem the token post-login. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/auth/login", url.origin));

  const res = await finalizeInviteAcceptance(token);
  if (res.error) {
    return NextResponse.redirect(new URL("/auth/login?error=invite", url.origin));
  }
  return NextResponse.redirect(new URL("/auth/mfa/enroll", url.origin));
}
