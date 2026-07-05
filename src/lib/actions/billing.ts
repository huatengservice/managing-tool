"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSubscriptionForm, type GatewayForm } from "@/lib/newebpay/mpg";

/**
 * SaaS billing (spec §10): Growth/Pro route to a real NewebPay recurring
 * (定期定額) checkout. The subscription activates — and entitlements flip —
 * only when the period webhook confirms authorization.
 */
export async function startSubscription(input: {
  companyId: string;
  planId: "growth" | "pro";
  email: string;
}): Promise<{ form?: GatewayForm; error?: string }> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return { error: "invalid_email" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // BO-only: memberships is RLS-readable; verify the role explicitly.
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", input.companyId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership?.role !== "bo") return { error: "not_authorized" };

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name_zh, price_monthly")
    .eq("id", input.planId)
    .single();
  if (!plan || plan.price_monthly <= 0) return { error: "invalid_plan" };

  const orderNo = `SUB${Date.now()}${randomBytes(2).toString("hex").toUpperCase()}`;
  const form = buildSubscriptionForm({
    merchantOrderNo: orderNo,
    amountPerPeriod: plan.price_monthly,
    description: `工作管理系統 ${plan.name_zh} 月費`,
    payerEmail: input.email,
  });
  if (!form) return { error: "gateway_not_configured" };

  const admin = createAdminClient();
  const { error } = await admin.from("company_subscriptions").insert({
    company_id: input.companyId,
    plan_id: input.planId,
    status: "pending",
    newebpay_period_no: orderNo,
  });
  if (error) return { error: "subscription_failed" };

  return { form };
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
