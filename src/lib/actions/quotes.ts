"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/jobs";

const lineItemsSchema = z
  .array(
    z.object({
      description: z.string().min(1),
      qty: z.number().positive(),
      unitPrice: z.number().min(0),
    })
  )
  .min(1);

function refresh() {
  revalidatePath("/bo", "layout");
  revalidatePath("/worker", "layout");
  revalidatePath("/portal", "layout");
}

/** Create/replace the draft quote for a job (BO-only via RLS). */
export async function saveQuoteDraft(input: {
  jobId: string;
  lineItems: { description: string; qty: number; unitPrice: number }[];
}): Promise<ActionResult> {
  const items = lineItemsSchema.safeParse(input.lineItems);
  if (!items.success) return { error: "invalid_items" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, status")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };

  // One live quote per job in v1: replace any existing draft.
  const { data: existing } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && existing.status !== "draft") return { error: "already_signed" };

  let quoteId = existing?.id;
  if (quoteId) {
    await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);
  } else {
    const { data: created, error } = await supabase
      .from("quotes")
      .insert({ company_id: job.company_id, job_id: job.id, created_by: user.id })
      .select("id")
      .single();
    if (error || !created) return { error: "quote_failed" };
    quoteId = created.id;
  }

  const { error: itemsError } = await supabase.from("quote_line_items").insert(
    items.data.map((li, i) => ({
      quote_id: quoteId,
      company_id: job.company_id,
      description: li.description.trim(),
      qty: li.qty,
      unit_price: li.unitPrice,
      position: i,
    }))
  );
  if (itemsError) return { error: "quote_failed" };

  refresh();
  return { id: quoteId };
}

/**
 * BO signs first (spec §3.2) — an authenticated in-app action recorded in
 * the append-only signature log. Job moves Created → Quoted.
 */
export async function signQuoteAsBo(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, job_id, company_id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "not_found" };
  if (quote.status !== "draft") return { error: "already_signed" };

  const { error: sigError } = await supabase.from("signatures").insert({
    company_id: quote.company_id,
    job_id: quote.job_id,
    quote_id: quote.id,
    subject_type: "quote",
    party: "bo",
    mechanism: "remote_account",
    signer_user_id: user.id,
  });
  if (sigError) return { error: "sign_failed" };

  await supabase.from("quotes").update({ status: "bo_signed" }).eq("id", quote.id);
  await supabase.from("jobs").update({ status: "quoted" }).eq("id", quote.job_id).eq("status", "created");

  refresh();
  return {};
}

/**
 * Customer signs second — device handoff (spec §3.2). The drawn signature
 * image was uploaded by the client; both mechanisms log identically:
 * timestamp, party, mechanism.
 */
export async function recordCustomerQuoteSignature(input: {
  quoteId: string;
  imagePath: string;
  signerName: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, job_id, company_id, status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (!quote) return { error: "not_found" };
  if (quote.status !== "bo_signed") return { error: "bo_must_sign_first" };

  const { error: sigError } = await supabase.from("signatures").insert({
    company_id: quote.company_id,
    job_id: quote.job_id,
    quote_id: quote.id,
    subject_type: "quote",
    party: "customer",
    mechanism: "device_handoff",
    signer_name: input.signerName || null,
    image_path: input.imagePath,
  });
  if (sigError) return { error: "sign_failed" };

  await supabase.from("quotes").update({ status: "accepted" }).eq("id", quote.id);
  await supabase.from("jobs").update({ status: "accepted" }).eq("id", quote.job_id).eq("status", "quoted");

  refresh();
  return {};
}

/**
 * Completion sign-off, first signer (spec §3.5): whoever did the work —
 * Worker, or BO if they personally did the job.
 */
export async function signCompletionAsStaff(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };
  if (!["accepted", "in_progress"].includes(job.status)) return { error: "wrong_status" };

  // After-photo requirement is enforced again by the DB when the status
  // flips (spec §5) — this early check just gives a friendly error.
  const { count } = await supabase
    .from("job_photos")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("type", "after");
  if (!count) return { error: "after_photo_required" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", job.company_id)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) return { error: "not_authorized" };

  const { error } = await supabase.from("signatures").insert({
    company_id: job.company_id,
    job_id: job.id,
    subject_type: "completion",
    party: membership.role,
    mechanism: "remote_account",
    signer_user_id: user.id,
  });
  if (error) return { error: "sign_failed" };

  refresh();
  return {};
}

/** Completion sign-off, customer second (device handoff). Job → Work Done. */
export async function recordCustomerCompletionSignature(input: {
  jobId: string;
  imagePath: string;
  signerName: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, status")
    .eq("id", input.jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };

  const { data: staffSig } = await supabase
    .from("signatures")
    .select("id")
    .eq("job_id", job.id)
    .eq("subject_type", "completion")
    .in("party", ["bo", "worker"])
    .limit(1)
    .maybeSingle();
  if (!staffSig) return { error: "staff_must_sign_first" };

  const { error: sigError } = await supabase.from("signatures").insert({
    company_id: job.company_id,
    job_id: job.id,
    subject_type: "completion",
    party: "customer",
    mechanism: "device_handoff",
    signer_name: input.signerName || null,
    image_path: input.imagePath,
  });
  if (sigError) return { error: "sign_failed" };

  const { error: statusError } = await supabase
    .from("jobs")
    .update({ status: "work_done" })
    .eq("id", job.id)
    .in("status", ["accepted", "in_progress"]);
  if (statusError) return { error: "after_photo_required" };

  refresh();
  return {};
}
