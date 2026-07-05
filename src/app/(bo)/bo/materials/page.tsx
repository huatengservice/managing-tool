import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { MaterialsClient, type MaterialRow } from "./materials-client";

export default async function MaterialsPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: materials }, { data: jobs }] = await Promise.all([
    supabase
      .from("materials")
      .select("*, jobs(code)")
      .eq("company_id", ctx.companyId)
      .order("purchased_on", { ascending: false }),
    supabase
      .from("jobs")
      .select("id, code, description")
      .eq("company_id", ctx.companyId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <MaterialsClient
      materials={(materials ?? []) as unknown as MaterialRow[]}
      jobs={jobs ?? []}
      companyId={ctx.companyId}
    />
  );
}
