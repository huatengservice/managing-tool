"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { CreditCard } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * TapPay Direct Pay card fields. The number/expiry/CCV inputs are iframes
 * served by TapPay — card data never touches our page or servers; the SDK
 * exchanges it for a one-time `prime` handed to the caller.
 */

interface TPDirectCardUpdate {
  canGetPrime: boolean;
}

interface TPDirectGlobal {
  setupSDK: (appId: number, appKey: string, env: "sandbox" | "production") => void;
  card: {
    setup: (config: unknown) => void;
    onUpdate: (cb: (update: TPDirectCardUpdate) => void) => void;
    getPrime: (cb: (result: { status: number; card: { prime: string } }) => void) => void;
  };
}

declare global {
  interface Window {
    TPDirect?: TPDirectGlobal;
  }
}

export function TapPayCardForm({
  buttonLabel,
  busyLabel,
  onPrime,
}: {
  buttonLabel: string;
  busyLabel: string;
  /** Called with the prime; throw/return an error message to display. */
  onPrime: (prime: string) => Promise<string | null>;
}) {
  const t = useT();
  const [sdkReady, setSdkReady] = useState(false);
  const [canPay, setCanPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setupDone = useRef(false);

  useEffect(() => {
    if (!sdkReady || setupDone.current || !window.TPDirect) return;
    setupDone.current = true;

    const appId = Number(process.env.NEXT_PUBLIC_TAPPAY_APP_ID);
    const appKey = process.env.NEXT_PUBLIC_TAPPAY_APP_KEY;
    if (!appId || !appKey) {
      setError(t("金流前端金鑰尚未設定", "Payment SDK keys are not configured"));
      return;
    }
    window.TPDirect.setupSDK(
      appId,
      appKey,
      process.env.NEXT_PUBLIC_TAPPAY_ENV === "production" ? "production" : "sandbox"
    );
    window.TPDirect.card.setup({
      fields: {
        number: { element: "#tp-card-number", placeholder: "**** **** **** ****" },
        expirationDate: { element: "#tp-card-exp", placeholder: "MM / YY" },
        ccv: { element: "#tp-card-ccv", placeholder: "CVV" },
      },
      styles: {
        input: { "font-size": "14px", color: "#334155" },
        "input.invalid": { color: "#e11d48" },
      },
    });
    window.TPDirect.card.onUpdate((update) => setCanPay(update.canGetPrime));
  }, [sdkReady, t]);

  function pay() {
    if (!window.TPDirect || busy) return;
    setBusy(true);
    setError(null);
    window.TPDirect.card.getPrime(async (result) => {
      if (result.status !== 0) {
        setError(t("卡片資料有誤，請確認後再試", "Card details look wrong — please check and retry"));
        setBusy(false);
        return;
      }
      try {
        const err = await onPrime(result.card.prime);
        if (err) {
          setError(err);
          setBusy(false);
        }
      } catch {
        setError(t("付款失敗，請再試一次", "Payment failed — please try again"));
        setBusy(false);
      }
    });
  }

  const fieldClass =
    "h-11 border border-slate-200 rounded-lg px-3 bg-white [&>iframe]:h-full [&>iframe]:w-full";

  return (
    <div>
      <Script
        src="https://js.tappaysdk.com/sdk/tpdirect/v5.19.2"
        onLoad={() => setSdkReady(true)}
      />
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-500">{t("卡號", "Card Number")}</label>
          <div id="tp-card-number" className={`mt-1 ${fieldClass}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("有效期限", "Expiry")}</label>
            <div id="tp-card-exp" className={`mt-1 ${fieldClass}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("安全碼", "CVV")}</label>
            <div id="tp-card-ccv" className={`mt-1 ${fieldClass}`} />
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
      <button
        onClick={pay}
        disabled={!canPay || busy}
        className="mt-4 w-full bg-slate-900 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <CreditCard size={15} />
        {busy ? busyLabel : buttonLabel}
      </button>
      <p className="text-[11px] text-slate-400 mt-2 text-center">
        {t(
          "卡片資料由 TapPay 安全欄位處理，本網站不會接觸或儲存您的卡號。",
          "Card details are handled by TapPay's secure fields — this site never sees or stores your card number."
        )}
      </p>
    </div>
  );
}
