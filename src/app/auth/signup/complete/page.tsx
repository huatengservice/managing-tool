"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createCompanyForCurrentUser } from "@/app/auth/actions";
import { useT } from "@/lib/i18n/provider";

/** Company details step for OAuth-based signups (account already exists). */
export default function SignupCompletePage() {
  const t = useT();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createCompanyForCurrentUser({ companyName, taxId });
    if (res.error) {
      setError(
        res.error === "invalid_tax_id"
          ? t("統一編號須為 8 位數字", "Tax ID must be 8 digits")
          : t("請輸入公司名稱", "Please enter a company name")
      );
      setBusy(false);
      return;
    }
    router.push("/auth/mfa/enroll");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Briefcase className="text-amber-400" size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">{t("建立您的公司", "Set Up Your Company")}</h1>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">
              {t("公司╱工程行名稱", "Company Name")}
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("例：華騰工程行", "e.g. Huateng Engineering")}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">
              {t("統一編號（選填）", "Business Tax ID (optional)")}
            </label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-60"
          >
            {t("建立公司並繼續", "Create Company & Continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
