import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptTradeInfo } from "@/lib/newebpay/crypto";
import { credsForWebhook } from "@/lib/newebpay/mpg";

interface PeriodResult {
  MerchantOrderNo?: string;
  MerOrderNo?: string;
  PeriodNo?: string;
  AuthTimes?: number;
  DateArray?: string;
}

/**
 * NewebPay 定期定額 NotifyURL — SaaS subscription authorization and each
 * period's charge. The payload is AES-encrypted with our merchant key;
 * failure to decrypt/parse means it isn't from NewebPay and is dropped.
 */
export async function POST(request: Request) {
  const creds = credsForWebhook();
  if (!creds) return new NextResponse("not configured", { status: 503 });

  const form = await request.formData();
  const encrypted = (form.get("Period") ?? form.get("TradeInfo"))?.toString();
  if (!encrypted) return new NextResponse("bad request", { status: 400 });

  let payload: { Status: string; Result: PeriodResult };
  try {
    payload = JSON.parse(decryptTradeInfo(encrypted, creds));
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  const admin = createAdminClient();
  const orderNo = payload.Result?.MerchantOrderNo ?? payload.Result?.MerOrderNo;

  const { data: sub } = await admin
    .from("company_subscriptions")
    .select("id, company_id, plan_id, status")
    .eq("newebpay_period_no", orderNo)
    .maybeSingle();

  await admin.from("billing_events").insert({
    company_id: sub?.company_id ?? null,
    kind: `period:${payload.Status}`,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (!sub) return new NextResponse("ok", { status: 200 });

  if (payload.Status === "SUCCESS") {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await admin
      .from("company_subscriptions")
      .update({
        status: "active",
        period_start: now.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);
    // Entitlements flip here — plan change is data, not code (spec §10).
    await admin.from("companies").update({ plan_id: sub.plan_id }).eq("id", sub.company_id);
  } else {
    await admin
      .from("company_subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  return new NextResponse("ok", { status: 200 });
}
