import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ScheduleClient, type EntryRow, type SchedulableJob } from "./schedule-client";
import type { Truck } from "@/lib/types";

export default async function SchedulePage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: entries }, { data: workers }, { data: trucks }, { data: jobs }] =
    await Promise.all([
      supabase
        .from("schedule_entries")
        .select("id, job_id, worker_id, truck_id, starts_at, ends_at, jobs(code, description, needs_truck, customers(name)), workers(name), trucks(name)")
        .eq("company_id", ctx.companyId),
      supabase
        .from("workers")
        .select("id, name")
        .eq("company_id", ctx.companyId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("trucks")
        .select("*")
        .eq("company_id", ctx.companyId)
        .eq("active", true)
        .order("name"),
      // Only jobs at Accepted+ can be scheduled (spec §6).
      supabase
        .from("jobs")
        .select("id, code, description, needs_truck, estimated_hours, customers(name)")
        .eq("company_id", ctx.companyId)
        .in("status", ["accepted", "in_progress"])
        .order("created_at", { ascending: false }),
    ]);

  return (
    <ScheduleClient
      entries={(entries ?? []) as unknown as EntryRow[]}
      workers={workers ?? []}
      trucks={(trucks ?? []) as Truck[]}
      jobs={(jobs ?? []) as unknown as SchedulableJob[]}
      companyId={ctx.companyId}
    />
  );
}
