import { createClient } from "@/lib/supabase/server";
import type {
  Customer, Invoice, Job, JobPhoto, Quote, QuoteLineItem, Signature,
} from "@/lib/types";
import type { DisplayPhoto } from "@/components/photo-upload-grid";

export interface JobDetailData {
  job: Job;
  customer: Customer;
  photos: DisplayPhoto[];
  quote: (Quote & { items: QuoteLineItem[] }) | null;
  signatures: Signature[];
  invoice: Invoice | null;
  workerNames: string[];
}

/**
 * Everything the job detail screen needs, fetched under the caller's RLS
 * (BO sees all; a worker only reaches jobs they created or are scheduled
 * on; a customer only their own).
 */
export async function loadJobDetail(jobId: string): Promise<JobDetailData | null> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return null;

  const [{ data: customer }, { data: photoRows }, { data: quoteRow }, { data: signatures }, { data: invoice }, { data: entries }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", job.customer_id).maybeSingle(),
      supabase.from("job_photos").select("*").eq("job_id", jobId).order("created_at"),
      supabase
        .from("quotes")
        .select("*, quote_line_items(*)")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("signatures").select("*").eq("job_id", jobId).order("signed_at"),
      supabase
        .from("invoices")
        .select("*")
        .eq("job_id", jobId)
        .neq("status", "voided")
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("schedule_entries").select("workers(name)").eq("job_id", jobId),
    ]);

  const photos: DisplayPhoto[] = [];
  const rows = (photoRows ?? []) as JobPhoto[];
  if (rows.length > 0) {
    const { data: signed } = await supabase.storage
      .from("job-photos")
      .createSignedUrls(
        rows.map((p) => p.storage_path),
        3600
      );
    rows.forEach((p, i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) photos.push({ id: p.id, url, type: p.type });
    });
  }

  const quote = quoteRow
    ? {
        ...(quoteRow as Quote),
        items: ((quoteRow as unknown as { quote_line_items: QuoteLineItem[] }).quote_line_items ?? []).sort(
          (a, b) => a.position - b.position
        ),
      }
    : null;

  const workerNames = Array.from(
    new Set(
      ((entries ?? []) as unknown as { workers: { name: string } | null }[])
        .map((e) => e.workers?.name)
        .filter((n): n is string => !!n)
    )
  );

  return {
    job: job as Job,
    customer: customer as Customer,
    photos,
    quote,
    signatures: (signatures ?? []) as Signature[],
    invoice: (invoice as Invoice) ?? null,
    workerNames,
  };
}
