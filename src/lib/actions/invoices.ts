"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { issueEinvoice } from "@/lib/newebpay/einvoice";
import type { ActionResult } from "@/lib/actions/jobs";

function refresh() {
  revalidatePath("/bo", "layout");
  revalidatePath("/portal", "layout");
}

/**
 * Invoicing is BO-only (spec §2) — RLS and the jobs trigger reject anyone
 * else even if this action is called directly. Choice of official
 * e-invoice (統一發票, via ezPay) or informal receipt (spec §3.6).
 * E-invoice requires a Growth/Pro plan (spec §10).
 */
export async function issueInvoice(input: {
  jobId: string;
  type: "einvoice" | "receipt";
  buyerUbn?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("*, customers(name), companies(plan_id, name, tax_id)")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };
  if (job.status !== "work_done") return { error: "work_not_done" };

  // Amount comes from the accepted (signed) quote.
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, quote_line_items(qty, unit_price)")
    .eq("job_id", job.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!quote) return { error: "no_accepted_quote" };
  const amount = Math.round(
    (quote.quote_line_items as { qty: number; unit_price: number }[]).reduce(
      (s, li) => s + li.qty * li.unit_price,
      0
    )
  );
  if (amount <= 0) return { error: "no_accepted_quote" };

  // Plan entitlement check (server-side, not just hidden buttons — §15.10).
  if (input.type === "einvoice") {
    const { data: plan } = await supabase
      .from("plans")
      .select("features")
      .eq("id", (job.companies as unknown as { plan_id: string }).plan_id)
      .single();
    if (!plan?.features?.einvoice) return { error: "plan_no_einvoice" };
  }

  const number = `INV-${new Date().getFullYear()}-${String(job.job_number).padStart(5, "0")}`;

  let einvoiceNumber: string | null = null;
  let einvoiceRandom: string | null = null;
  let providerRaw: unknown = null;
  if (input.type === "einvoice") {
    const result = await issueEinvoice({
      orderNo: number.replace(/-/g, ""),
      amount,
      buyerName: (job.customers as unknown as { name: string }).name,
      buyerUbn: input.buyerUbn ?? null,
      itemName: "水電工程服務",
    });
    if (!result.ok) return { error: result.error ?? "einvoice_failed" };
    einvoiceNumber = result.invoiceNumber ?? null;
    einvoiceRandom = result.randomNum ?? null;
    providerRaw = result.raw ?? null;
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: job.company_id,
      job_id: job.id,
      quote_id: quote.id,
      type: input.type,
      number,
      amount,
      einvoice_number: einvoiceNumber,
      einvoice_random: einvoiceRandom,
      provider_raw: providerRaw,
      issued_by: user.id,
    })
    .select("id")
    .single();
  if (error || !invoice) return { error: "invoice_failed" };

  await supabase.from("jobs").update({ status: "invoiced" }).eq("id", job.id).eq("status", "work_done");
  refresh();
  return { id: invoice.id };
}

/** Manual cash/transfer marking (spec §3.6). Card payments come via webhook. */
export async function markInvoicePaid(input: {
  invoiceId: string;
  method: "cash" | "transfer";
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, company_id, job_id, amount, status")
    .eq("id", input.invoiceId)
    .maybeSingle();
  if (!invoice) return { error: "not_found" };
  if (invoice.status !== "unpaid") return { error: "not_unpaid" };

  const { error: payError } = await supabase.from("payments").insert({
    company_id: invoice.company_id,
    invoice_id: invoice.id,
    amount: invoice.amount,
    method: input.method,
    status: "succeeded",
    provider: "manual",
  });
  if (payError) return { error: "payment_failed" };

  await supabase
    .from("invoices")
    .update({
      status: "paid",
      payment_method: input.method,
      paid_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
  await supabase.from("jobs").update({ status: "paid" }).eq("id", invoice.job_id).eq("status", "invoiced");

  refresh();
  return {};
}
