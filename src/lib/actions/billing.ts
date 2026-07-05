"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SaaS billing (spec §10). Payments moved to TapPay (owner decision
 * 2026-07-05): the recurring checkout collects a card via TapPay's secure
 * fields and stores only the returned card token; a scheduled job charges
 * it monthly. The card-token checkout lands in the follow-up PR — until
 * then upgrades report the gateway as unavailable.
 */
export async function startSubscription(input: {
  companyId: string;
  planId: "growth" | "pro";
  email: string;
}): Promise<{ error?: string }> {
  void input;
  return { error: "gateway_not_configured" };
}

/** Downgrade to the free tier; cancels the active subscription record. */
export async function downgradeToStarter(companyId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // companies UPDATE is BO-only under RLS — this fails for anyone else.
  const { error } = await supabase
    .from("companies")
    .update({ plan_id: "starter" })
    .eq("id", companyId);
  if (error) return { error: "not_authorized" };

  const admin = createAdminClient();
  await admin
    .from("company_subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .in("status", ["active", "pending", "past_due"]);

  revalidatePath("/bo/billing");
  return {};
}
