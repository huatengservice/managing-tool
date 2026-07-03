"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteWithPassword } from "@/app/auth/actions";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { formatPhone } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/provider";

export function InviteAcceptForm({
  token,
  workerName,
  workerPhone,
}: {
  token: string;
  workerName: string;
  workerPhone: string;
}) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await acceptInviteWithPassword({
      token,
      phone: workerPhone,
      password,
      displayName: workerName,
    });
    if (res.error) {
      setError(
        res.error === "phone_taken"
          ? t(
              "此手機號碼已有帳號 — 請先登入原帳號後再開啟此邀請連結",
              "This phone number already has an account — log into it first, then open this invite link again"
            )
          : res.error === "invite_invalid"
            ? t("邀請連結已失效", "This invite link is no longer valid")
            : t("設定失敗，密碼至少需 8 碼", "Setup failed — password must be at least 8 characters")
      );
      setBusy(false);
      return;
    }
    router.push("/auth/mfa/enroll");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
        <input
          value={formatPhone(workerPhone)}
          readOnly
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-slate-50 text-slate-500"
        />
        <span className="text-[11px] text-slate-400">{t("老闆邀請時已填入", "Filled in by the owner's invite")}</span>
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
        {t("設定密碼並繼續", "Set Password & Continue")}
      </button>
      <OAuthButtons next={`/auth/invite-complete?token=${encodeURIComponent(token)}`} />
      <p className="text-[11px] text-slate-400 pt-1">
        {t(
          "接受邀請後將需要設定雙重驗證（驗證器 App）。",
          "After accepting, you'll set up two-factor authentication (authenticator app)."
        )}
      </p>
    </form>
  );
}
