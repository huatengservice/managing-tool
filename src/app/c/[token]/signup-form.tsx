"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpCustomerWithPassword } from "@/lib/actions/customer-auth";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { formatPhone } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/provider";

export function CustomerSignupForm({ token, phone }: { token: string; phone: string }) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signUpCustomerWithPassword({ token, password });
    if (res.error) {
      setError(
        res.error === "phone_taken"
          ? t("此手機號碼已有帳號，請直接登入", "This phone number already has an account — just log in")
          : res.error === "weak_password"
            ? t("密碼至少需 8 碼", "Password must be at least 8 characters")
            : t("建立失敗，請請師傅重新產生 QR", "Signup failed — ask for a fresh QR code")
      );
      setBusy(false);
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
        <input
          value={formatPhone(phone)}
          readOnly
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"
        />
        <span className="text-[11px] text-slate-400">{t("已自動帶入", "Auto-filled")}</span>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">
          {t("設定密碼（至少 8 碼）", "Set Password (min. 8 characters)")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <button
        disabled={busy}
        className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 mt-2 disabled:opacity-60"
      >
        {t("建立帳戶", "Create Account")}
      </button>
      <OAuthButtons next={`/auth/customer-complete?token=${encodeURIComponent(token)}`} />
    </form>
  );
}
