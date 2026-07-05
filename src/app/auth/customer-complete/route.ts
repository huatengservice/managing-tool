import { NextResponse } from "next/server";
import { finalizeCustomerAccount } from "@/lib/actions/customer-auth";

/** OAuth continuation of the customer QR signup: link account post-login. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/auth/login", url.origin));

  const res = await finalizeCustomerAccount(token);
  if (res.error) {
    return NextResponse.redirect(new URL("/auth/login?error=customer-signup", url.origin));
  }
  return NextResponse.redirect(new URL("/portal", url.origin));
}
