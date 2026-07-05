import { NextResponse } from "next/server";

/**
 * NewebPay 定期定額 ReturnURL — browser lands here after authorization.
 * Display-only; the subscription activates via the period webhook.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/bo/billing", origin), 303);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/bo/billing", origin), 303);
}
