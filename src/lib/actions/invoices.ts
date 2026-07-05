"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/jobs";

function refresh() {
  revalidatePath("/bo", "layout");
  revalidatePath("/portal", "layout");
}

/**
 * Billing is BO-only (spec §2) — RLS and the jobs trigger reject anyone
 * else even if this action is called directly.
 *
 * Owner decision 2026-07-05: the business is a 小規模營業人 that doesn't
 * issue 統一發票, so the informal receipt (免用統一發票收據) is the billing
 * document; e-invoice/ezPay was removed. An optional buyer 統編 can be
 * printed for business customers.
 */
export async function issueInvoice(input: {
  jobId: string;
  buyerUbn?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };
  if (input.buyerUbn && !/^\d{8}$/.test(input.buyerUbn.trim())) return { error: "invalid_ubn" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, job_number, status")
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

  const number = `R-${new Date().getFullYear()}-${String(job.job_number).padStart(5, "0")}`;

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      company_id: job.company_id,
      job_id: job.id,
      quote_id: quote.id,
      type: "receipt",
      number,
      amount,
      buyer_ubn: input.buyerUbn?.trim() || null,
      issued_by: user.id,
    })
    .select("id")
    .single();
  if (error || !invoice) return { error: "invoice_failed" };

  await supabase.from("jobs").update({ status: "invoiced" }).eq("id", job.id).eq("status", "work_done");
  refresh();
  return { id: invoice.id };
}

/** Manual cash/transfer marking (spec §3.6). Card payments confirm via TapPay server-side. */
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
