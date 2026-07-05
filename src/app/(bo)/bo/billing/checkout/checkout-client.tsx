"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TapPayCardForm } from "@/components/tappay-card-form";
import { subscribeWithPrime } from "@/lib/actions/billing";
import { useLang, useT } from "@/lib/i18n/provider";
import type { Plan } from "@/lib/types";

export function CheckoutClient({
  plan,
  companyId,
  configured,
}: {
  plan: Plan;
  companyId: string;
  configured: boolean;
}) {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState("");

  async function onPrime(prime: string): Promise<string | null> {
    const res = await subscribeWithPrime({
      companyId,
      planId: plan.id as "growth" | "pro",
      email,
      prime,
    });
    if (!res.error) {
      router.push("/bo/billing");
      router.refresh();
      return null;
    }
    return res.error === "invalid_email"
      ? t("請先輸入有效的帳單通知電子郵件", "Enter a valid billing email first")
      : res.error === "gateway_not_configured"
        ? t("金流金鑰尚未設定（TAPPAY_*）", "Payment gateway credentials not configured (TAPPAY_*)")
        : t("授權未成功，請確認卡片後再試", "Authorization was declined — check the card and retry");
  }

  return (
    <div className="max-w-sm mx-auto">
      <Link href="/bo/billing" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} />
        {t("返回方案與帳單", "Back to Plan & Billing")}
      </Link>
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h1 className="font-bold text-slate-800">
          {t(`升級至 ${plan.name_zh}`, `Upgrade to ${plan.name_en}`)}
        </h1>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          {t(
            `每月 NT$${plan.price_monthly.toLocaleString()}，今日扣款第一期，之後每月自動扣款；可隨時降級取消。`,
            `NT$${plan.price_monthly.toLocaleString()}/month — first month charged today, then billed monthly; downgrade anytime to cancel.`
          )}
        </p>

        {!configured ? (
          <p className="text-sm text-rose-500">
            {t("金流金鑰尚未設定（TAPPAY_*），暫時無法升級。", "Payment gateway credentials (TAPPAY_*) are not configured yet.")}
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500">
                {t("帳單通知電子郵件", "Billing notification email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <TapPayCardForm
              buttonLabel={t(
                `授權並訂閱（${lang === "en" ? plan.name_en : plan.name_zh}）`,
                `Authorize & Subscribe (${lang === "en" ? plan.name_en : plan.name_zh})`
              )}
              busyLabel={t("授權處理中…", "Authorizing…")}
              onPrime={onPrime}
            />
          </>
        )}
      </div>
    </div>
  );
}
