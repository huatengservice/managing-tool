"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import type { ActionResult } from "@/lib/actions/jobs";

const INVITE_TTL_DAYS = 7;

const addWorkerSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().refine(isValidPhone),
  rateType: z.enum(["hourly", "daily"]),
  rate: z.number().min(0),
});

/**
 * Spec §8: one action adds the worker to the roster (status Invited) AND
 * generates the unique single-use invite link, shown to the BO immediately.
 * No automated SMS/messaging — the BO sends it personally.
 */
export async function addWorkerWithInvite(
  input: z.infer<typeof addWorkerSchema>
): Promise<ActionResult & { inviteUrl?: string }> {
  const parsed = addWorkerSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient();
  const token = generateToken();

  const { data: worker, error } = await supabase
    .from("workers")
    .insert({
      company_id: d.companyId,
      name: d.name.trim(),
      phone: normalizePhone(d.phone),
      status: "invited",
      invite_token_hash: hashToken(token),
      invite_expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !worker) return { error: "worker_failed" };

  // Rate is BO-only data (spec §7) — separate table, BO-only RLS.
  const { error: rateError } = await supabase.from("worker_rates").insert({
    worker_id: worker.id,
    company_id: d.companyId,
    rate_type: d.rateType,
    rate: d.rate,
  });
  if (rateError) return { error: "rate_failed" };

  revalidatePath("/bo/team");
  return { id: worker.id, inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}` };
}

/** Regenerate (resend) a pending invite — the old link stops working. */
export async function regenerateInvite(workerId: string): Promise<ActionResult & { inviteUrl?: string }> {
  const supabase = await createClient();
  const token = generateToken();
  const { error } = await supabase
    .from("workers")
    .update({
      invite_token_hash: hashToken(token),
      invite_expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
    })
    .eq("id", workerId)
    .eq("status", "invited");
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return { inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}` };
}

/** Revoke a pending invite (roster row stays, link dies). */
export async function revokeInvite(workerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workers")
    .update({ invite_token_hash: null, invite_expires_at: null })
    .eq("id", workerId)
    .eq("status", "invited");
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return {};
}

/**
 * Deactivate/reactivate. Deactivation keeps historical job records with
 * the company (spec §7) and also disables the login membership.
 */
export async function setWorkerActive(workerId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: worker, error } = await supabase
    .from("workers")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", workerId)
    .select("company_id, user_id")
    .single();
  if (error || !worker) return { error: "update_failed" };

  if (worker.user_id) {
    const admin = createAdminClient();
    await admin
      .from("memberships")
      .update({ active })
      .eq("company_id", worker.company_id)
      .eq("user_id", worker.user_id)
      .eq("role", "worker");
  }
  revalidatePath("/bo/team");
  return {};
}

export async function updateWorkerRate(input: {
  workerId: string;
  companyId: string;
  rateType: "hourly" | "daily";
  rate: number;
}): Promise<ActionResult> {
  if (input.rate < 0) return { error: "invalid_input" };
  const supabase = await createClient();
  const { error } = await supabase.from("worker_rates").upsert({
    worker_id: input.workerId,
    company_id: input.companyId,
    rate_type: input.rateType,
    rate: input.rate,
  });
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return {};
}

/** BO's private notes about a worker: tags + incident log (spec §7). */
export async function saveWorkerNotes(input: {
  workerId: string;
  companyId: string;
  tags: string[];
  log: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("bo_worker_notes").upsert({
    worker_id: input.workerId,
    company_id: input.companyId,
    tags: input.tags,
    log: input.log,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return {};
}

// ---------- trucks (second bookable resource, spec §6) ----------

export async function addTruck(companyId: string, name: string): Promise<ActionResult> {
  if (!name.trim()) return { error: "invalid_input" };
  const supabase = await createClient();
  const { error } = await supabase.from("trucks").insert({ company_id: companyId, name: name.trim() });
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return {};
}

export async function setTruckActive(truckId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("trucks").update({ active }).eq("id", truckId);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/team");
  return {};
}
