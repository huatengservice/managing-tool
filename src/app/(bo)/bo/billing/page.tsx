import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { BillingClient } from "./billing-client";
import type { CompanySubscription, Plan } from "@/lib/types";

export default async function BillingPage() {
  const ctx = await requireAuthContext("bo");
  const supabase = await createClient();

  const [{ data: plans }, { data: subscription }] = await Promise.all([
    supabase.from("plans").select("*").order("sort"),
    supabase
      .from("company_subscriptions")
      .select("*")
      .eq("company_id", ctx.companyId)
      .in("status", ["active", "pending", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <BillingClient
      plans={(plans ?? []) as Plan[]}
      currentPlanId={ctx.plan.id}
      subscription={(subscription as CompanySubscription) ?? null}
      company={ctx.company}
    />
  );
}
