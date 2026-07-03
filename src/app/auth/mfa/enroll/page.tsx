"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { issueBackupCodes } from "@/app/auth/actions";
import { useT } from "@/lib/i18n/provider";

/**
 * Mandatory TOTP enrollment (spec §8): QR + manual key fallback → 6-digit
 * confirmation → backup recovery codes with explicit save acknowledgement.
 */
export default function MfaEnrollPage() {
  const t = useT();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"scan" | "backup">("scan");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enrolling = useRef(false);

  const enroll = useCallback(async () => {
    if (enrolling.current) return;
    enrolling.current = true;
    const supabase = createClient();
    // Clean up an unverified factor left by a previous abandoned attempt.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "authenticator",
    });
    if (error || !data) {
      setError(t("無法啟用雙重驗證，請重新整理再試", "Could not start 2FA enrollment — refresh and try again"));
      return;
    }
    setFactorId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
  }, [t]);

  useEffect(() => {
    void enroll();
  }, [enroll]);

  async function confirm() {
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
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verify.error) {
      setError(t("驗證碼不正確", "That code is not correct"));
      setBusy(false);
      return;
    }
    const res = await issueBackupCodes();
    if (res.codes) {
      setBackupCodes(res.codes);
      setPhase("backup");
    } else {
      router.push("/auth/after");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5">
        <h1 className="text-sm font-bold text-slate-800 mb-1">
          {t("設定雙重驗證（必要步驟）", "Set Up Two-Factor Authentication (Required)")}
        </h1>
        <p className="text-xs text-slate-400 mb-4">
          {t(
            "此帳號可存取客戶個資與營運數據，需設定雙重驗證才能繼續使用",
            "This account can access customer data and business records — 2FA is required to continue"
          )}
        </p>

        {phase === "scan" && (
          <>
            <p className="text-xs font-semibold text-slate-500 mb-2">
              {t("步驟 1：使用驗證器 App 掃描", "Step 1: Scan with an authenticator app")}
            </p>
            <div className="flex justify-center mb-3">
              {qrSvg ? (
                // Supabase returns the QR as an SVG data URI.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSvg} alt="TOTP QR code" className="h-40 w-40 border border-slate-200 rounded-lg" />
              ) : (
                <div className="h-40 w-40 bg-slate-100 rounded-lg animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 text-center mb-1">
              {t("建議使用 Google Authenticator 或 Authy", "We recommend Google Authenticator or Authy")}
            </p>
            {secret && (
              <div className="bg-slate-50 rounded-lg p-2 text-center mb-4">
                <p className="text-[10px] text-slate-400">
                  {t("無法掃描？手動輸入此金鑰", "Can't scan? Enter this key manually")}
                </p>
                <p className="text-xs font-mono text-slate-600 tracking-wider break-all">{secret}</p>
              </div>
            )}
            <p className="text-xs font-semibold text-slate-500 mb-2">
              {t("步驟 2：輸入 App 顯示的 6 位數驗證碼", "Step 2: Enter the 6-digit code from the app")}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full text-center text-lg font-bold tracking-[0.5em] border border-slate-200 rounded-lg py-2.5 mb-4 focus:border-amber-400 outline-none"
            />
            {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
            <button
              onClick={confirm}
              disabled={busy || code.length !== 6}
              className="w-full bg-slate-900 text-white text-sm font-semibold rounded-lg py-2.5 disabled:opacity-50"
            >
              {t("確認設定", "Confirm Setup")}
            </button>
          </>
        )}

        {phase === "backup" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                {t("請保存備用復原碼", "Save your backup recovery codes")}
              </p>
              <p className="text-[11px] text-amber-600 mb-2">
                {t(
                  "若日後遺失驗證器裝置，可使用以下任一組復原碼重新設定。每組僅能使用一次，請截圖或抄寫保存於安全處。",
                  "If you ever lose your authenticator device, use any one of these codes to regain access. Each works once — save them somewhere safe."
                )}
              </p>
              <div className="grid grid-cols-2 gap-1.5 bg-white rounded-lg p-2">
                {backupCodes.map((c) => (
                  <span key={c} className="text-[11px] font-mono text-slate-600 text-center py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 mb-4">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="rounded"
              />
              {t("我已保存復原碼", "I've saved my recovery codes")}
            </label>
            <button
              onClick={() => router.push("/auth/after")}
              disabled={!acknowledged}
              className="w-full bg-emerald-600 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {t("完成設定，進入系統", "Finish setup and continue")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
