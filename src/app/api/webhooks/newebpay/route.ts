import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptTradeInfo, verifyTradeSha } from "@/lib/newebpay/crypto";
import { credsForWebhook } from "@/lib/newebpay/mpg";

/**
 * NewebPay MPG NotifyURL — invoice card payments.
 *
 * Spec §15.4: the notification is trusted ONLY after its SHA-256 check
 * value verifies against our merchant HashKey/HashIV. Anything else is
 * dropped — otherwise anyone could fake a "payment succeeded" event.
 */
export async function POST(request: Request) {
  const creds = credsForWebhook();
  if (!creds) return new NextResponse("not configured", { status: 503 });

  const form = await request.formData();
  const tradeInfo = form.get("TradeInfo")?.toString();
  const receivedSha = form.get("TradeSha")?.toString();
  if (!tradeInfo || !receivedSha) return new NextResponse("bad request", { status: 400 });

  if (!verifyTradeSha(tradeInfo, receivedSha, creds)) {
    // Signature mismatch — do not trust, do not process.
    return new NextResponse("signature mismatch", { status: 400 });
  }

  let payload: {
    Status: string;
    Result: { MerchantOrderNo: string; TradeNo?: string; Amt: number; PayTime?: string };
  };
  try {
    payload = JSON.parse(decryptTradeInfo(tradeInfo, creds));
  } catch {
    return new NextResponse("bad payload", { status: 400 });
  }

  const admin = createAdminClient();
  const orderNo = payload.Result?.MerchantOrderNo;

  const { data: payment } = await admin
    .from("payments")
    .select("id, invoice_id, company_id, amount, status")
    .eq("provider", "newebpay")
    .eq("provider_trade_no", orderNo)
    .maybeSingle();

  await admin.from("billing_events").insert({
    company_id: payment?.company_id ?? null,
    kind: `mpg:${payload.Status}`,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (!payment) return new NextResponse("ok", { status: 200 }); // unknown order — logged above
  if (payment.status === "succeeded") return new NextResponse("ok", { status: 200 }); // idempotent

  if (payload.Status === "SUCCESS" && Number(payload.Result.Amt) === payment.amount) {
    await admin
      .from("payments")
      .update({ status: "succeeded", raw: payload as unknown as Record<string, unknown> })
      .eq("id", payment.id);
    const { data: invoice } = await admin
      .from("invoices")
      .update({ status: "paid", payment_method: "card", paid_at: new Date().toISOString() })
      .eq("id", payment.invoice_id)
      .eq("status", "unpaid")
      .select("job_id")
      .maybeSingle();
    if (invoice) {
      await admin.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id).eq("status", "invoiced");
    }
  } else if (payload.Status !== "SUCCESS") {
    await admin
      .from("payments")
      .update({ status: "failed", raw: payload as unknown as Record<string, unknown> })
      .eq("id", payment.id);
  }

  return new NextResponse("ok", { status: 200 });
}
