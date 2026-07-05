import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { JobListClient, type JobRow } from "@/components/jobs/job-list";

export default async function BoJobsPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, code, status, urgency, category, description, disputed, customers(name, phone, address), schedule_entries(workers(name))"
    )
    .eq("company_id", ctx.companyId)
    .order("created_at", { ascending: false });

  return (
    <JobListClient
      jobs={(data ?? []) as unknown as JobRow[]}
      companyId={ctx.companyId}
      basePath="/bo/jobs"
      canCreate
    />
  );
}
