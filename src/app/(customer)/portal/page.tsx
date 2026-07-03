import { requireCustomerContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalClient, type PortalJob } from "./portal-client";
import type { Invoice, JobStatus, Quote, QuoteLineItem, Signature } from "@/lib/types";

/**
 * Customer portal (spec §9): full job history — not just jobs going
 * forward — plus remote signing, invoices, and the customer's own private
 * notes (visible only to them).
 */
export default async function PortalPage() {
  const { userId } = await requireCustomerContext();
  const supabase = await createClient();

  // RLS scopes every one of these to this customer's own records.
  const [{ data: jobs }, { data: quotes }, { data: invoices }, { data: signatures }, { data: notes }, { data: photos }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, code, status, description, created_at, company_id, companies:companies(name)")
        .order("created_at", { ascending: false }),
      supabase.from("quotes").select("*, quote_line_items(*)"),
      supabase.from("invoices").select("*"),
      supabase.from("signatures").select("*"),
      supabase.from("customer_private_notes").select("job_id, note"),
      supabase.from("job_photos").select("id, job_id, type, storage_path").order("created_at"),
    ]);

  // Customers can't sign storage URLs themselves (bucket policies are
  // member-scoped); sign server-side after the RLS-scoped select above
  // proved access. Signed URLs are short-lived (spec §15.6).
  const admin = createAdminClient();
  const photoRows = photos ?? [];
  const signedByPath = new Map<string, string>();
  if (photoRows.length > 0) {
    const { data: signed } = await admin.storage
      .from("job-photos")
      .createSignedUrls(photoRows.map((p) => p.storage_path), 1800);
    photoRows.forEach((p, i) => {
      const url = signed?.[i]?.signedUrl;
      if (url) signedByPath.set(p.storage_path, url);
    });
  }

  const noteByJob = new Map((notes ?? []).map((n) => [n.job_id, n.note]));

  const portalJobs: PortalJob[] = (jobs ?? []).map((j) => {
    const quote = (quotes ?? []).find((q) => q.job_id === j.id) as
      | (Quote & { quote_line_items: QuoteLineItem[] })
      | undefined;
    const total = quote
      ? quote.quote_line_items.reduce((s, li) => s + li.qty * li.unit_price, 0)
      : 0;
    return {
      id: j.id,
      code: j.code,
      status: j.status as JobStatus,
      description: j.description,
      companyName: (j.companies as unknown as { name: string } | null)?.name ?? "",
      total,
      quote: quote
        ? { id: quote.id, status: quote.status, items: quote.quote_line_items }
        : null,
      invoice: ((invoices ?? []).find((i) => i.job_id === j.id) as Invoice | undefined) ?? null,
      signatures: ((signatures ?? []) as Signature[]).filter((s) => s.job_id === j.id),
      note: noteByJob.get(j.id) ?? "",
      photos: photoRows
        .filter((p) => p.job_id === j.id)
        .map((p) => ({
          id: p.id as string,
          type: p.type as "before" | "after",
          url: signedByPath.get(p.storage_path) ?? "",
        }))
        .filter((p) => p.url),
    };
  });

  return <PortalClient jobs={portalJobs} />;
}
