import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { loadJobDetail } from "@/lib/job-detail-data";
import { JobDetailClient } from "@/components/jobs/job-detail";

export default async function BoJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuthContext("bo");
  const { id } = await params;
  const data = await loadJobDetail(id);
  if (!data) notFound();
  return <JobDetailClient data={data} asWorker={false} backHref="/bo/jobs" />;
}
