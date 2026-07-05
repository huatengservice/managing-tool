import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { addMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { payByCardToken } from "@/lib/tappay/server";

const PAST_DUE_GRACE_DAYS = 7;

/**
 * Monthly subscription billing (Vercel cron, daily). Charges each active
 * subscription whose period has ended using its stored TapPay card token;
 * a failed charge marks it past_due, and past_due beyond the grace period
 * downgrades the company to Starter.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env
 * var is set — anything else is rejected.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const summary = { charged: 0, failed: 0, downgraded: 0 };

  // 1. Charge subscriptions whose paid period has ended.
  const { data: due } = await admin
    .from("company_subscriptions")
    .select("*, plans(name_zh, price_monthly)")
    .eq("status", "active")
    .lte("period_end", todayStr)
    .not("card_token", "is", null);

  for (const sub of due ?? []) {
    const plan = sub.plans as unknown as { name_zh: string; price_monthly: number };
    const orderNumber = `SUB${Date.now()}${randomBytes(2).toString("hex").toUpperCase()}`;
    const result = await payByCardToken({
      cardKey: sub.card_key,
      cardToken: sub.card_token,
      amount: plan.price_monthly,
      details: `工作管理系統 ${plan.name_zh} 月費`,
      orderNumber,
    });

    await admin.from("billing_events").insert({
      company_id: sub.company_id,
      kind: `tappay:renewal:${result.status}`,
      payload: (result.raw ?? { status: result.status, msg: result.msg }) as Record<string, unknown>,
    });

    if (result.status === 0) {
      await admin
        .from("company_subscriptions")
        .update({
          period_start: sub.period_end,
          period_end: addMonths(new Date(sub.period_end), 1).toISOString().slice(0, 10),
          updated_at: today.toISOString(),
        })
        .eq("id", sub.id);
      summary.charged++;
    } else {
      await admin
        .from("company_subscriptions")
        .update({ status: "past_due", updated_at: today.toISOString() })
        .eq("id", sub.id);
      summary.failed++;
    }
  }

  // 2. Downgrade companies past the grace period.
  const graceCutoff = new Date(today.getTime() - PAST_DUE_GRACE_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  const { data: expired } = await admin
    .from("company_subscriptions")
    .select("id, company_id")
    .eq("status", "past_due")
    .lte("period_end", graceCutoff);

  for (const sub of expired ?? []) {
    await admin.from("companies").update({ plan_id: "starter" }).eq("id", sub.company_id);
    await admin
      .from("company_subscriptions")
      .update({ status: "cancelled", updated_at: today.toISOString() })
      .eq("id", sub.id);
    await admin.from("billing_events").insert({
      company_id: sub.company_id,
      kind: "subscription:downgraded_after_grace",
      payload: { subscription_id: sub.id, grace_days: PAST_DUE_GRACE_DAYS },
    });
    summary.downgraded++;
  }

  return NextResponse.json(summary);
}
