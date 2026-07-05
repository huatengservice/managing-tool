import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { loadJobDetail } from "@/lib/job-detail-data";
import { JobDetailClient } from "@/components/jobs/job-detail";

export default async function WorkerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthContext("worker");
  const { id } = await params;
  // RLS returns nothing unless this worker created or is scheduled on the job.
  const data = await loadJobDetail(id);
  if (!data) notFound();
  return <JobDetailClient data={data} asWorker backHref="/worker/jobs" />;
}
