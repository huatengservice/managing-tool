import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { InsightsClient, type InsightJob, type WeekPoint } from "./insights-client";

export default async function InsightsPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: fin }, { data: jobs }, { data: invoices }, { data: materials }] =
    await Promise.all([
      supabase.from("job_financials").select("*").eq("company_id", ctx.companyId),
      supabase
        .from("jobs")
        .select("id, code, description, status, updated_at, customers(name)")
        .eq("company_id", ctx.companyId),
      supabase
        .from("invoices")
        .select("id, amount, status, issued_at")
        .eq("company_id", ctx.companyId)
        .neq("status", "voided"),
      supabase
        .from("materials")
        .select("purchased_on, qty, unit_price")
        .eq("company_id", ctx.companyId),
    ]);

  const jobById = new Map(
    (jobs ?? []).map((j) => [
      j.id,
      {
        code: j.code as string,
        description: j.description as string,
        status: j.status as string,
        updated_at: j.updated_at as string,
        customerName: (j.customers as unknown as { name: string } | null)?.name ?? "",
      },
    ])
  );

  // Per-job profitability, only for jobs with revenue on the books.
  const insightJobs: InsightJob[] = (fin ?? [])
    .filter((f) => Number(f.revenue) > 0)
    .map((f) => {
      const j = jobById.get(f.job_id);
      return {
        jobId: f.job_id,
        code: f.code,
        customerName: j?.customerName ?? "",
        description: j?.description ?? "",
        revenue: Number(f.revenue),
        laborCost: Number(f.labor_cost),
        materialCost: Number(f.material_cost),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const unpaidTotal = (invoices ?? [])
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.amount, 0);

  // Weekly revenue-vs-cost trend, last 8 weeks. Revenue books when an
  // invoice is issued; costs book when materials are bought / work wraps.
  const weeks: WeekPoint[] = [];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const revenue = (invoices ?? [])
      .filter((inv) => {
        const d = new Date(inv.issued_at);
        return d >= start && d < end;
      })
      .reduce((s, inv) => s + inv.amount, 0);

    const materialCost = (materials ?? [])
      .filter((m) => {
        const d = new Date(m.purchased_on + "T00:00:00");
        return d >= start && d < end;
      })
      .reduce((s, m) => s + m.qty * m.unit_price, 0);

    const laborCost = (fin ?? [])
      .filter((f) => {
        const j = jobById.get(f.job_id);
        if (!j || !["work_done", "invoiced", "paid"].includes(j.status)) return false;
        const d = new Date(j.updated_at);
        return d >= start && d < end;
      })
      .reduce((s, f) => s + Number(f.labor_cost), 0);

    weeks.push({
      week: `${start.getMonth() + 1}/${start.getDate()}`,
      revenue,
      cost: Math.round(materialCost + laborCost),
    });
  }

  return <InsightsClient jobs={insightJobs} weeks={weeks} unpaidTotal={unpaidTotal} />;
}
