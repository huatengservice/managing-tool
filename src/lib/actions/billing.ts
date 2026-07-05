"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payByPrime } from "@/lib/tappay/server";

/**
 * SaaS billing (spec §10) on TapPay. The checkout charges the first month
 * with `remember: true`, which returns a reusable card token — only that
 * token is stored (never a card number); /api/cron/billing charges it
 * monthly thereafter.
 */
export async function subscribeWithPrime(input: {
  companyId: string;
  planId: "growth" | "pro";
  email: string;
  prime: string;
}): Promise<{ error?: string }> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) return { error: "invalid_email" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // BO-only: verify the role explicitly (spec §15.10).
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  const orderNumber = `SUB${Date.now()}${randomBytes(2).toString("hex").toUpperCase()}`;
  const result = await payByPrime({
    prime: input.prime,
    amount: plan.price_monthly,
    details: `工作管理系統 ${plan.name_zh} 月費`,
    orderNumber,
    cardholder: {
      name: profile?.display_name || "Business Owner",
      phone: profile?.phone || "",
      email: input.email,
    },
    remember: true, // returns the card token for monthly recurring charges
  });

  const admin = createAdminClient();
  await admin.from("billing_events").insert({
    company_id: input.companyId,
    kind: `tappay:subscribe:${result.status}`,
    payload: (result.raw ?? { status: result.status, msg: result.msg }) as Record<string, unknown>,
  });

  if (result.status !== 0 || !result.card_secret) {
    return { error: result.status === -1 ? "gateway_not_configured" : "declined" };
  }

  const today = new Date();
  // Replace any previous subscription with the new authorization.
  await admin
    .from("company_subscriptions")
    .update({ status: "cancelled", updated_at: today.toISOString() })
    .eq("company_id", input.companyId)
    .in("status", ["active", "pending", "past_due"]);
  const { error: subError } = await admin.from("company_subscriptions").insert({
    company_id: input.companyId,
    plan_id: plan.id,
    status: "active",
    card_key: result.card_secret.card_key,
    card_token: result.card_secret.card_token,
    billing_email: input.email,
    period_start: today.toISOString().slice(0, 10),
    period_end: addMonths(today, 1).toISOString().slice(0, 10),
  });
  if (subError) return { error: "subscription_failed" };

  // Entitlements flip immediately — plan change is data, not code (spec §10).
  await admin.from("companies").update({ plan_id: plan.id }).eq("id", input.companyId);

  revalidatePath("/bo", "layout");
  return {};
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
