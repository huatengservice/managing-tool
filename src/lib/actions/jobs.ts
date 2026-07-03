"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/auth/phone";

export interface ActionResult {
  error?: string;
  id?: string;
}

const createJobSchema = z.object({
  companyId: z.string().uuid(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerAddress: z.string().default(""),
  category: z.enum(["water", "electric"]),
  description: z.string().min(1),
  urgency: z.enum(["normal", "urgent"]),
  needsTruck: z.boolean(),
  estimatedHours: z.number().positive().nullable(),
});

/**
 * Job creation (spec §3.1) — BO or Worker. Reuses an existing customer
 * with the same phone in this company, otherwise creates one.
 */
export async function createJob(input: z.infer<typeof createJobSchema>): Promise<ActionResult> {
  const parsed = createJobSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const phone = normalizePhone(d.customerPhone);
  let customerId: string;
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("company_id", d.companyId)
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    customerId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        company_id: d.companyId,
        name: d.customerName.trim(),
        phone,
        address: d.customerAddress.trim(),
      })
      .select("id")
      .single();
    if (error || !created) return { error: "customer_failed" };
    customerId = created.id;
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      company_id: d.companyId,
      customer_id: customerId,
      category: d.category,
      description: d.description.trim(),
      urgency: d.urgency,
      needs_truck: d.needsTruck,
      estimated_hours: d.estimatedHours,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !job) return { error: "job_failed" };

  revalidatePath("/bo", "layout");
  revalidatePath("/worker", "layout");
  return { id: job.id };
}

/** Worker/BO updates after work: actual hours + variance note (spec §3.4). */
export async function updateJobWork(input: {
  jobId: string;
  actualHours: number | null;
  varianceNote: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({
      actual_hours: input.actualHours,
      variance_note: input.varianceNote?.trim() || null,
    })
    .eq("id", input.jobId);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo", "layout");
  revalidatePath("/worker", "layout");
  return {};
}

/** Start work: Accepted → In Progress. */
export async function startWork(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "in_progress" })
    .eq("id", jobId)
    .in("status", ["accepted"]);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo", "layout");
  revalidatePath("/worker", "layout");
  return {};
}

/** Cancellation requires a reason; who/when is logged by the DB trigger (spec §4). */
export async function cancelJob(jobId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { error: "reason_required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "cancelled", cancellation_reason: reason.trim() })
    .eq("id", jobId);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo", "layout");
  revalidatePath("/worker", "layout");
  return {};
}

/** Dispute flag: BO-only; the platform holds evidence, it does not mediate (spec §4). */
export async function setDisputed(jobId: string, disputed: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ disputed }).eq("id", jobId);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo", "layout");
  return {};
}
