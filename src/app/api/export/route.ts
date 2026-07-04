import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tenant data export (spec §15.14, PDPA expectation): the BO downloads
 * everything their company owns as JSON. All queries run under the
 * caller's RLS, so a non-BO gets empty sets and no company row → 403.
 * The three private-note layers behave per their own boundaries: the BO's
 * notes export; customers' private notes never appear here.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("company");
  if (!companyId) return new NextResponse("company required", { status: 400 });

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return new NextResponse("forbidden", { status: 403 });

  const tables = [
    "customers",
    "jobs",
    "job_photos",
    "quotes",
    "quote_line_items",
    "signatures",
    "invoices",
    "payments",
    "materials",
    "workers",
    "worker_rates",
    "bo_worker_notes",
    "bo_customer_notes",
    "trucks",
    "schedule_entries",
    "consent_logs",
  ] as const;

  const exportData: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    company,
  };
  for (const table of tables) {
    const { data } = await supabase.from(table).select("*").eq("company_id", companyId);
    exportData[table] = data ?? [];
  }

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="export-${companyId}-${Date.now()}.json"`,
    },
  });
}
