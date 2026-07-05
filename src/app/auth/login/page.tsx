"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, LogIn } from "lucide-react";
import { signInWithPhone } from "@/app/auth/actions";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LanguageToggle, useT } from "@/lib/i18n/provider";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/auth/after";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signInWithPhone({ phone, password });
    if (res.error) {
      setError(t("手機號碼或密碼錯誤", "Incorrect phone number or password"));
      setBusy(false);
      return;
    }
    router.push(next);
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
            <Lock className="text-amber-400" size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">{t("登入", "Log In")}</h1>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX-XXX-XXX"
              autoComplete="username"
              inputMode="tel"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("密碼", "Password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2 flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <LogIn size={15} />
            {t("登入", "Log In")}
          </button>
          <OAuthButtons next={next} />
          <div className="border-t border-slate-100 pt-3 mt-1 text-[11px] text-slate-400">
            {t(
              "此系統可存取客戶個資與營運數據，登入將要求雙重驗證，並在閒置一段時間後自動登出。",
              "This system can access customer data and business records. Login requires 2FA, and sessions auto-expire after inactivity."
            )}
          </div>
        </form>

        {/* Company signup is public and discoverable (spec §8); worker
            accounts are invite-only and have no equivalent entry point. */}
        <p className="text-center text-sm text-slate-500 mt-4">
          {t("還沒有公司帳號？", "Don't have a company account yet?")}{" "}
          <Link href="/auth/signup" className="text-amber-600 font-semibold">
            {t("建立公司帳號", "Create one")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
