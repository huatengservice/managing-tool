"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCircle } from "lucide-react";
import { completeOAuthProfile } from "@/app/auth/actions";
import { useT } from "@/lib/i18n/provider";

/**
 * OAuth signups still collect a phone number — it stays the primary
 * identifier for invite-matching, multi-company, and roster display
 * (spec §8), auto-filled from the provider when available.
 */
function CompleteProfileForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/auth/after";
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await completeOAuthProfile({ phone, displayName });
    if (res.error) {
      setError(
        res.error === "invalid_phone"
          ? t("請輸入有效的手機號碼", "Please enter a valid phone number")
          : t("儲存失敗，請再試一次", "Could not save — try again")
      );
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserCircle className="text-amber-400" size={26} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">{t("完成基本資料", "Complete Your Profile")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("手機號碼是系統中的主要識別資訊", "Your phone number is the primary identifier in this system")}
          </p>
        </div>
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("姓名", "Name")}</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX-XXX-XXX"
              inputMode="tel"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-60"
          >
            {t("繼續", "Continue")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}
