import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { StageBadge, UrgencyTag } from "@/components/jobs/badges";
import { WorkerJobsHeader, WorkerJobsEmpty } from "./ui";
import type { JobStatus, JobUrgency } from "@/lib/types";

interface WorkerJob {
  id: string;
  code: string;
  status: JobStatus;
  urgency: JobUrgency;
  description: string;
  customers: { name: string; address: string } | null;
  schedule_entries: { starts_at: string }[];
}

/**
 * Worker home: RLS already limits this to jobs they created or are
 * scheduled on (spec §2 "own assigned jobs only") — the query needs no
 * extra filtering beyond company.
 */
export default async function WorkerJobsPage() {
  const ctx = await requireAuthContext("worker");
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, code, status, urgency, description, customers(name, address), schedule_entries(starts_at)")
    .eq("company_id", ctx.companyId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const jobs = (data ?? []) as unknown as WorkerJob[];

  return (
    <div>
      <WorkerJobsHeader count={jobs.length} companyId={ctx.companyId} />
      <div className="space-y-3">
        {jobs.map((j) => {
          const nextStart = j.schedule_entries
            .map((e) => new Date(e.starts_at))
            .sort((a, b) => a.getTime() - b.getTime())
            .find((d) => d.getTime() > Date.now() - 86400_000);
          return (
            <Link
              key={j.id}
              href={`/worker/jobs/${j.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-300"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-800 flex items-center gap-2">
                  {j.customers?.name}
                  <span className="text-xs font-mono font-normal text-slate-400">{j.code}</span>
                  <UrgencyTag urgency={j.urgency} />
                </span>
                <StageBadge status={j.status} />
              </div>
              <p className="text-sm text-slate-500">{j.description}</p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <MapPin size={11} />
                {j.customers?.address}
                {nextStart && (
                  <span className="ml-2 text-amber-600 font-semibold">
                    {nextStart.toLocaleString()}
                  </span>
                )}
              </p>
            </Link>
          );
        })}
        {jobs.length === 0 && <WorkerJobsEmpty />}
      </div>
    </div>
  );
}
