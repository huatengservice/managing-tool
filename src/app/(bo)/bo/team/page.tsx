import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { TeamClient, type WorkerRow } from "./team-client";
import type { Truck, WorkerStatus, RateType } from "@/lib/types";

export default async function TeamPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: workers }, { data: rates }, { data: notes }, { data: trucks }] = await Promise.all([
    supabase
      .from("workers")
      .select("id, name, phone, status, invite_expires_at, invite_token_hash")
      .eq("company_id", ctx.companyId)
      .order("invited_at"),
    supabase.from("worker_rates").select("worker_id, rate_type, rate").eq("company_id", ctx.companyId),
    supabase.from("bo_worker_notes").select("worker_id, tags, log").eq("company_id", ctx.companyId),
    supabase.from("trucks").select("*").eq("company_id", ctx.companyId).order("name"),
  ]);

  const rateBy = new Map((rates ?? []).map((r) => [r.worker_id, r]));
  const noteBy = new Map((notes ?? []).map((n) => [n.worker_id, n]));

  const rows: WorkerRow[] = (workers ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    phone: w.phone,
    status: w.status as WorkerStatus,
    hasPendingInvite:
      w.status === "invited" &&
      !!w.invite_token_hash &&
      !!w.invite_expires_at &&
      new Date(w.invite_expires_at) > new Date(),
    rateType: (rateBy.get(w.id)?.rate_type ?? "hourly") as RateType,
    rate: Number(rateBy.get(w.id)?.rate ?? 0),
    tags: (noteBy.get(w.id)?.tags ?? []) as string[],
    log: noteBy.get(w.id)?.log ?? "",
  }));

  return (
    <TeamClient
      workers={rows}
      trucks={(trucks ?? []) as Truck[]}
      companyId={ctx.companyId}
      maxWorkers={ctx.plan.features.max_workers}
    />
  );
}
