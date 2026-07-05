import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payByPrime } from "@/lib/tappay/server";

/**
 * Charge an invoice with a TapPay prime. Payment truth (spec §15.4) is the
 * synchronous result of OUR authenticated call to TapPay — the client's
 * claim is never trusted; it only supplies the one-time prime.
 */
export async function POST(request: Request) {
  let body: { invoiceId?: string; prime?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.invoiceId || !body.prime) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, jobs(description, customers(name, phone)), companies(name, plan_id)")
    .eq("id", body.invoiceId)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (invoice.status !== "unpaid") return NextResponse.json({ error: "already_paid" }, { status: 409 });

  // Server-side plan entitlement check (spec §15.10).
  const { data: plan } = await admin
    .from("plans")
    .select("features")
    .eq("id", (invoice.companies as unknown as { plan_id: string }).plan_id)
    .single();
  if (!plan?.features?.online_payment) {
    return NextResponse.json({ error: "not_enabled" }, { status: 403 });
  }

  const job = invoice.jobs as unknown as {
    description: string;
    customers: { name: string; phone: string };
  };
  const orderNumber = `PAY${Date.now()}${randomBytes(2).toString("hex").toUpperCase()}`;

  const { data: payment } = await admin
    .from("payments")
    .insert({
      company_id: invoice.company_id,
      invoice_id: invoice.id,
      amount: invoice.amount,
      method: "card",
      status: "pending",
      provider: "tappay",
      provider_trade_no: orderNumber,
    })
    .select("id")
    .single();

  const result = await payByPrime({
    prime: body.prime,
    amount: invoice.amount,
    details: job.description,
    orderNumber,
    cardholder: {
      name: job.customers.name,
      phone: job.customers.phone,
      // TapPay requires an email field; receipts are delivered in-app.
      email: "receipts@managing-tool-five.vercel.app",
    },
  });

  await admin.from("billing_events").insert({
    company_id: invoice.company_id,
    kind: `tappay:pay-by-prime:${result.status}`,
    payload: (result.raw ?? { status: result.status, msg: result.msg }) as Record<string, unknown>,
  });

  if (result.status !== 0) {
    if (payment) {
      await admin
        .from("payments")
        .update({ status: "failed", raw: result.raw as Record<string, unknown> })
        .eq("id", payment.id);
    }
    return NextResponse.json({ error: "declined" }, { status: 402 });
  }

  if (payment) {
    await admin
      .from("payments")
      .update({
        status: "succeeded",
        provider_trade_no: result.rec_trade_id ?? orderNumber,
        raw: result.raw as Record<string, unknown>,
      })
      .eq("id", payment.id);
  }
  const { data: paidInvoice } = await admin
    .from("invoices")
    .update({ status: "paid", payment_method: "card", paid_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("status", "unpaid")
    .select("job_id")
    .maybeSingle();
  if (paidInvoice) {
    await admin.from("jobs").update({ status: "paid" }).eq("id", paidInvoice.job_id).eq("status", "invoiced");
  }

  return NextResponse.json({ ok: true });
}
