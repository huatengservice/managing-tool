"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, X } from "lucide-react";
import { downgradeToStarter, startSubscription } from "@/lib/actions/billing";
import { useLang, useT } from "@/lib/i18n/provider";
import { updateCompanyInfo } from "@/lib/actions/company";
import type { Company, CompanySubscription, Plan, PlanId } from "@/lib/types";

export function BillingClient({
  plans,
  currentPlanId,
  subscription,
  company,
}: {
  plans: Plan[];
  currentPlanId: PlanId;
  subscription: CompanySubscription | null;
  company: Company;
}) {
  const companyId = company.id;
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [upgradeTarget, setUpgradeTarget] = useState<Plan | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const featureLines = (p: Plan) => {
    const lines: string[] = [
      t("案件、報價、排程、簽署、收據、材料紀錄", "Jobs, quotes, scheduling, signing, receipts, materials"),
    ];
    if (p.features.online_payment) lines.push(t("線上刷卡收款", "Online card payments"));
    if (p.features.cross_worker_dashboard)
      lines.push(t("跨師傅營運分析", "Cross-worker business insights"));
    if (p.features.priority_support) lines.push(t("優先客服支援", "Priority support"));
    lines.push(
      p.features.max_workers === null
        ? t("師傅人數不限", "Unlimited workers")
        : t(`最多 ${p.features.max_workers} 位師傅`, `Up to ${p.features.max_workers} workers`)
    );
    return lines;
  };

  async function upgrade() {
    if (!upgradeTarget) return;
    setBusy(true);
    setError(null);
    const res = await startSubscription({
      companyId,
      planId: upgradeTarget.id as "growth" | "pro",
      email,
    });
    if (res.error) {
      setError(
        res.error === "invalid_email"
          ? t("請輸入有效的電子郵件", "Enter a valid email address")
          : res.error === "gateway_not_configured"
            ? t("金流金鑰尚未設定（TAPPAY_*）", "Payment gateway credentials not configured (TAPPAY_*)")
            : t("升級失敗，請再試一次", "Upgrade failed — try again")
      );
      setBusy(false);
      return;
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">{t("方案與帳單", "Plan & Billing")}</h2>
      <p className="text-sm text-slate-500 mb-5">
        {t("目前方案：", "Current plan: ")}
        <span className="font-semibold text-slate-700">
          {plans.find((p) => p.id === currentPlanId)?.[lang === "en" ? "name_en" : "name_zh"]}
        </span>
        {subscription?.status === "pending" && (
          <span className="ml-2 text-xs text-amber-600">
            {t("（升級授權處理中）", "(upgrade authorization pending)")}
          </span>
        )}
        {subscription?.status === "past_due" && (
          <span className="ml-2 text-xs text-rose-600">
            {t("（扣款失敗，請更新付款方式）", "(payment failed — update your card)")}
          </span>
        )}
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isCurrent = p.id === currentPlanId;
          return (
            <div
              key={p.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col ${
                isCurrent ? "border-amber-400 shadow-sm" : "border-slate-200"
              }`}
            >
              <h3 className="font-bold text-slate-800">
                {lang === "en" ? p.name_en : p.name_zh}
              </h3>
              <p className="mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  NT${p.price_monthly.toLocaleString()}
                </span>
                <span className="text-sm text-slate-400">{t(" /月", " /mo")}</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600 flex-1">
                {featureLines(p).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="mt-5 text-center text-sm font-semibold text-amber-600 py-2.5">
                  {t("目前方案", "Current plan")}
                </span>
              ) : p.price_monthly === 0 ? (
                <button
                  onClick={async () => {
                    await downgradeToStarter(companyId);
                    router.refresh();
                  }}
                  className="mt-5 text-sm font-semibold border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 text-slate-600"
                >
                  {t("降級至入門版", "Downgrade to Starter")}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setUpgradeTarget(p);
                    setError(null);
                  }}
                  className="mt-5 text-sm font-semibold bg-slate-900 text-white rounded-xl py-2.5 hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <CreditCard size={14} />
                  {t("升級並設定扣款", "Upgrade & set up billing")}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-4">
        {t(
          "付費方案以信用卡（TapPay）每月定期扣款；升級於授權成功後立即生效。",
          "Paid plans bill monthly by card via TapPay; upgrades take effect as soon as authorization succeeds."
        )}
      </p>

      <CompanyInfoCard company={company} />

      <div className="mt-8 border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold text-slate-700 mb-1">{t("資料匯出", "Data Export")}</h3>
        <p className="text-xs text-slate-400 mb-3">
          {t(
            "隨時可下載貴公司的全部資料（JSON 格式）：案件、客戶、報價、簽署紀錄、帳單、材料等。",
            "Download everything your company owns (JSON): jobs, customers, quotes, signature log, invoices, materials, and more."
          )}
        </p>
        <a
          href={`/api/export?company=${companyId}`}
          className="inline-block text-sm font-semibold border border-slate-200 rounded-xl px-4 py-2.5 hover:bg-slate-50 text-slate-600"
        >
          {t("匯出全部資料", "Export all data")}
        </a>
      </div>

      {/* upgrade modal below */}
      {upgradeTarget && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">
                {t(
                  `升級至 ${upgradeTarget.name_zh}`,
                  `Upgrade to ${upgradeTarget.name_en}`
                )}
              </h3>
              <button onClick={() => setUpgradeTarget(null)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              {t(
                `每月 NT$${upgradeTarget.price_monthly.toLocaleString()}，卡片資料由 TapPay 安全欄位處理。`,
                `NT$${upgradeTarget.price_monthly.toLocaleString()}/month, card handled by TapPay's secure fields.`
              )}
            </p>
            <label className="text-xs font-semibold text-slate-500">
              {t("帳單通知電子郵件", "Billing notification email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm mb-3"
            />
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            <button
              onClick={upgrade}
              disabled={busy}
              className="w-full bg-slate-900 text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-60"
            >
              {busy ? t("準備中…", "Preparing…") : t("前往付款授權", "Continue to payment")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Seller details printed on every receipt (免用統一發票收據). */
function CompanyInfoCard({ company }: { company: Company }) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    name: company.name,
    taxId: company.tax_id ?? "",
    address: company.address,
    phone: company.phone,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await updateCompanyInfo({ companyId: company.id, ...form });
    setStatus(res.error ? "error" : "saved");
    if (!res.error) {
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-bold text-slate-700 mb-1">
        {t("公司資料（顯示於收據）", "Company Info (printed on receipts)")}
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        {t(
          "收據上的商號名稱、統一編號、地址與電話取自這裡。",
          "The seller name, tax ID, address, and phone on receipts come from here."
        )}
      </p>
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-3 max-w-2xl">
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("商號名稱", "Business Name")}</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">
            {t("統一編號（選填）", "Tax ID (optional)")}
          </label>
          <input
            value={form.taxId}
            onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
            inputMode="numeric"
            maxLength={8}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("地址", "Address")}</label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("電話", "Phone")}</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            inputMode="tel"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            disabled={status === "saving"}
            className="text-sm font-semibold bg-slate-900 text-white rounded-xl px-4 py-2.5 disabled:opacity-60"
          >
            {t("儲存公司資料", "Save Company Info")}
          </button>
          {status === "saved" && <span className="text-xs text-emerald-600">{t("已儲存 ✓", "Saved ✓")}</span>}
          {status === "error" && (
            <span className="text-xs text-rose-500">
              {t("儲存失敗（統編須為 8 位數字）", "Save failed (tax ID must be 8 digits)")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
