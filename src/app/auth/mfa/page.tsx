"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { redeemBackupCode, signOut } from "@/app/auth/actions";
import { useT } from "@/lib/i18n/provider";

/** TOTP verification (aal1 → aal2), with backup-code recovery fallback. */
function MfaVerify() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/auth/after";
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
      } else {
        // Mandatory 2FA: no verified factor yet means enrollment comes first.
        router.replace("/auth/mfa/enroll");
      }
    });
  }, [router]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setError(t("驗證失敗，請再試一次", "Verification failed — try again"));
      setBusy(false);
      return;
    }
    const res = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (res.error) {
      setError(t("驗證碼不正確", "That code is not correct"));
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function redeem() {
    setBusy(true);
    setError(null);
    const res = await redeemBackupCode(backupCode);
    if (res.error) {
      setError(t("復原碼無效或已使用", "That recovery code is invalid or already used"));
      setBusy(false);
      return;
    }
    // The stale factor was removed; enroll a fresh authenticator now.
    router.push("/auth/mfa/enroll");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5">
        {!backupMode ? (
          <>
            <p className="text-sm text-slate-600 mb-1 font-semibold">
              {t("輸入雙重驗證碼", "Enter Your 2FA Code")}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {t(
                "請開啟驗證器 App（如 Google Authenticator）輸入 6 位數字",
                "Open your authenticator app (e.g. Google Authenticator) and enter the 6-digit code"
              )}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              className="w-full text-center text-lg font-bold tracking-[0.5em] border border-slate-200 rounded-lg py-2.5 mb-3 focus:border-amber-400 outline-none"
            />
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            <button
              onClick={verify}
              disabled={busy || code.length !== 6 || !factorId}
              className="w-full bg-emerald-600 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {t("驗證並登入", "Verify & Log In")}
            </button>
            <button
              onClick={() => setBackupMode(true)}
              className="w-full text-[11px] text-slate-400 mt-3 hover:text-slate-600"
            >
              {t("遺失驗證器裝置？改用備用復原碼", "Lost your authenticator? Use a backup recovery code instead")}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-1 font-semibold">
              {t("使用備用復原碼", "Use a Backup Recovery Code")}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              {t(
                "輸入註冊時保存的任一組未使用復原碼。驗證後將移除舊的驗證器，並引導您重新設定。",
                "Enter any unused recovery code you saved during setup. This removes the old authenticator and walks you through setting up a new one."
              )}
            </p>
            <input
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              autoFocus
              className="w-full text-center text-base font-mono border border-slate-200 rounded-lg py-2.5 mb-3 focus:border-amber-400 outline-none"
            />
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            <button
              onClick={redeem}
              disabled={busy || backupCode.length < 8}
              className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {t("驗證復原碼", "Verify Recovery Code")}
            </button>
            <button
              onClick={() => setBackupMode(false)}
              className="w-full text-[11px] text-slate-400 mt-3 hover:text-slate-600"
            >
              {t("返回輸入驗證碼", "Back to authenticator code")}
            </button>
          </>
        )}
        <button
          onClick={() => signOut()}
          className="w-full text-[11px] text-slate-300 mt-4 hover:text-slate-500"
        >
          {t("登出", "Log out")}
        </button>
      </div>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense>
      <MfaVerify />
    </Suspense>
  );
}
