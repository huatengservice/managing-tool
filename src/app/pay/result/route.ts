import { NextResponse } from "next/server";
import { verifyTradeSha } from "@/lib/newebpay/crypto";
import { credsForWebhook } from "@/lib/newebpay/mpg";

/**
 * NewebPay ReturnURL (browser redirect after checkout). This is display
 * routing only — the invoice is marked paid exclusively by the NotifyURL
 * webhook (spec §15.4).
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  let ok = false;
  try {
    const form = await request.formData();
    const tradeInfo = form.get("TradeInfo")?.toString();
    const sha = form.get("TradeSha")?.toString();
    const creds = credsForWebhook();
    ok = !!(tradeInfo && sha && creds && verifyTradeSha(tradeInfo, sha, creds));
  } catch {
    ok = false;
  }
  return NextResponse.redirect(new URL(`/pay/done?ok=${ok ? "1" : "0"}`, origin), 303);
}
