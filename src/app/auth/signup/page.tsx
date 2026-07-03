"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { signUpCompany } from "@/app/auth/actions";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguageToggle, useT } from "@/lib/i18n/provider";

/** Public company signup — the discoverable "建立公司帳號" path (spec §8). */
export default function CompanySignupPage() {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    taxId: "",
    displayName: "",
    phone: "",
    password: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError(t("請先同意服務條款與隱私權政策", "Please agree to the Terms and Privacy Policy first"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await signUpCompany(form);
    if (res.error) {
      setError(
        res.error === "phone_taken"
          ? t("此手機號碼已註冊過帳號", "An account already exists for this phone number")
          : res.error === "invalid_tax_id"
            ? t("統一編號須為 8 位數字", "Tax ID must be 8 digits")
            : res.error === "company_name_required"
              ? t("請輸入公司名稱", "Please enter a company name")
              : t("註冊失敗，請確認手機號碼與密碼（至少 8 碼）", "Signup failed — check the phone number and password (min. 8 characters)")
      );
      setBusy(false);
      return;
    }
    // 2FA enrollment is mandatory before entering the app (spec §8).
    router.push("/auth/mfa/enroll");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-4">
          <LanguageToggle />
        </div>
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Briefcase className="text-amber-400" size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">{t("建立公司帳號", "Create Company Account")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("給第一次使用的老闆", "For business owners setting up for the first time")}
          </p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">
              {t("公司╱工程行名稱", "Company Name")}
            </label>
            <input
              value={form.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder={t("例：華騰工程行", "e.g. Huateng Engineering")}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">
              {t("統一編號（選填，日後開立電子發票需要）", "Business Tax ID (optional, needed for e-invoices)")}
            </label>
            <input
              value={form.taxId}
              onChange={(e) => set("taxId", e.target.value)}
              placeholder={t("可稍後補上", "Can add later")}
              inputMode="numeric"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("您的姓名", "Your Name")}</label>
            <input
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("您的手機號碼", "Your Phone Number")}</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="09XX-XXX-XXX"
              inputMode="tel"
              autoComplete="username"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("設定密碼（至少 8 碼）", "Set Password (min. 8 characters)")}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="rounded mt-0.5"
            />
            <span>
              {t("我已閱讀並同意", "I have read and agree to the")}{" "}
              <Link href="/legal/terms" target="_blank" className="text-amber-600 underline">
                {t("服務條款", "Terms of Service")}
              </Link>
              {t("、", ", ")}
              <Link href="/legal/privacy" target="_blank" className="text-amber-600 underline">
                {t("隱私權政策", "Privacy Policy")}
              </Link>
              {t(" 與 ", " and ")}
              <Link href="/legal/dpa" target="_blank" className="text-amber-600 underline">
                {t("資料處理協議", "Data Processing Agreement")}
              </Link>
            </span>
          </label>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-60"
          >
            {t("建立帳號並繼續", "Create Account & Continue")}
          </button>
          <OAuthButtons next="/auth/signup/complete" />
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          {t("已經有帳號？", "Already have an account?")}{" "}
          <Link href="/auth/login" className="text-amber-600 font-semibold">
            {t("登入", "Log in")}
          </Link>
        </p>
      </div>
    </div>
  );
}
