import Link from "next/link";
import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { UrgencyTag } from "@/components/jobs/badges";
import { PipelineHeader, PipelineColumnTitle, NoJobs, AssignedTo, DisputedBadge } from "./ui";
import { JOB_PIPELINE, type JobStatus } from "@/lib/types";

interface PipelineJob {
  id: string;
  code: string;
  status: JobStatus;
  urgency: "normal" | "urgent";
  disputed: boolean;
  description: string;
  customers: { name: string } | null;
  schedule_entries: { workers: { name: string } | null }[];
}

/** Kanban pipeline — BO-only, full visibility (spec §6). */
export default async function PipelinePage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, code, status, urgency, disputed, description, customers(name), schedule_entries(workers(name))"
    )
    .eq("company_id", ctx.companyId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const jobs = (data ?? []) as unknown as PipelineJob[];

  return (
    <div>
      <PipelineHeader />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {JOB_PIPELINE.map((status) => {
          const col = jobs.filter((j) => j.status === status);
          return (
            <div key={status} className="min-w-[220px] flex-1">
              <PipelineColumnTitle status={status} count={col.length} />
              <div className="space-y-2">
                {col.map((j) => {
                  const worker = j.schedule_entries.find((e) => e.workers)?.workers?.name;
                  return (
                    <Link
                      key={j.id}
                      href={`/bo/jobs/${j.id}`}
                      className="block bg-white border border-slate-200 rounded-xl p-3 hover:border-amber-300 hover:shadow-sm transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-400">{j.code}</span>
                        <UrgencyTag urgency={j.urgency} />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{j.customers?.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{j.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        {worker ? <AssignedTo name={worker} /> : <span />}
                        {j.disputed && <DisputedBadge />}
                      </div>
                    </Link>
                  );
                })}
                {col.length === 0 && <NoJobs />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
