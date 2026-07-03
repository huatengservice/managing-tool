"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/jobs";

const entrySchema = z.object({
  companyId: z.string().uuid(),
  jobId: z.string().uuid(),
  workerId: z.string().uuid(),
  truckId: z.string().uuid().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
});

export interface ScheduleConflict {
  kind: "worker" | "truck";
  jobCode: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Overlap check for worker and truck bookings. Conflicts are SURFACED for
 * the BO to resolve manually, never auto-blocked (spec §6) — the caller
 * decides whether to proceed.
 */
export async function findConflicts(input: {
  companyId: string;
  workerId: string;
  truckId: string | null;
  startsAt: string;
  endsAt: string;
  excludeEntryId?: string;
}): Promise<ScheduleConflict[]> {
  const supabase = await createClient();
  let query = supabase
    .from("schedule_entries")
    .select("id, worker_id, truck_id, starts_at, ends_at, jobs(code)")
    .eq("company_id", input.companyId)
    .lt("starts_at", input.endsAt)
    .gt("ends_at", input.startsAt);
  if (input.excludeEntryId) query = query.neq("id", input.excludeEntryId);

  const { data } = await query;
  const conflicts: ScheduleConflict[] = [];
  for (const e of data ?? []) {
    const jobCode = (e.jobs as unknown as { code: string } | null)?.code ?? "?";
    if (e.worker_id === input.workerId) {
      conflicts.push({ kind: "worker", jobCode, startsAt: e.starts_at, endsAt: e.ends_at });
    }
    if (input.truckId && e.truck_id === input.truckId) {
      conflicts.push({ kind: "truck", jobCode, startsAt: e.starts_at, endsAt: e.ends_at });
    }
  }
  return conflicts;
}

export async function createScheduleEntry(input: z.infer<typeof entrySchema>): Promise<ActionResult> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // Scheduling starts once a quote is accepted (spec §3.3).
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, needs_truck")
    .eq("id", d.jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };
  if (!["accepted", "in_progress", "work_done"].includes(job.status)) {
    return { error: "job_not_accepted" };
  }

  const { error } = await supabase.from("schedule_entries").insert({
    company_id: d.companyId,
    job_id: d.jobId,
    worker_id: d.workerId,
    truck_id: d.truckId,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    created_by: user.id,
  });
  if (error) return { error: "insert_failed" };
  revalidatePath("/bo/schedule");
  revalidatePath("/worker", "layout");
  return {};
}

/** Drag-to-reschedule/reassign (spec §6). */
export async function moveScheduleEntry(input: {
  entryId: string;
  startsAt: string;
  endsAt: string;
  workerId?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, string> = { starts_at: input.startsAt, ends_at: input.endsAt };
  if (input.workerId) patch.worker_id = input.workerId;
  const { error } = await supabase.from("schedule_entries").update(patch).eq("id", input.entryId);
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/schedule");
  revalidatePath("/worker", "layout");
  return {};
}

export async function deleteScheduleEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("schedule_entries").delete().eq("id", entryId);
  if (error) return { error: "delete_failed" };
  revalidatePath("/bo/schedule");
  revalidatePath("/worker", "layout");
  return {};
}
