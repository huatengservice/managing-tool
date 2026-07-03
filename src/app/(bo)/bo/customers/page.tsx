import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { CustomersClient, type CustomerRow } from "./customers-client";
import type { JobStatus } from "@/lib/types";

export default async function CustomersPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: customers }, { data: notes }, { data: jobs }, { data: accounts }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, address")
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false }),
      supabase.from("bo_customer_notes").select("customer_id, tags").eq("company_id", ctx.companyId),
      supabase
        .from("jobs")
        .select("id, customer_id, code, description, status")
        .eq("company_id", ctx.companyId)
        .order("created_at", { ascending: false }),
      supabase.from("customer_accounts").select("customer_id").eq("company_id", ctx.companyId),
    ]);

  const tagsByCustomer = new Map((notes ?? []).map((n) => [n.customer_id, n.tags as string[]]));
  const accountSet = new Set((accounts ?? []).map((a) => a.customer_id));

  const rows: CustomerRow[] = (customers ?? []).map((c) => ({
    ...c,
    tags: tagsByCustomer.get(c.id) ?? [],
    hasAccount: accountSet.has(c.id),
    jobs: (jobs ?? [])
      .filter((j) => j.customer_id === c.id)
      .map((j) => ({ id: j.id, code: j.code, description: j.description, status: j.status as JobStatus })),
  }));

  return <CustomersClient customers={rows} companyId={ctx.companyId} />;
}
