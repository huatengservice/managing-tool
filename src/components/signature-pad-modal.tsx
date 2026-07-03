"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PenTool, X } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

/**
 * Device-handoff signature capture (spec §3): the BO/Worker hands their
 * device to the customer, who draws a signature. The PNG goes to the
 * private signatures bucket and an append-only signatures row is written
 * by the caller.
 */
export function SignaturePadModal({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  onConfirm: (pngBlob: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const padRef = useRef<SignatureCanvas>(null);
  const [empty, setEmpty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    setBusy(true);
    setError(null);
    const dataUrl = pad.getTrimmedCanvas().toDataURL("image/png");
    const blob = await (await fetch(dataUrl)).blob();
    try {
      await onConfirm(blob);
      onClose();
    } catch {
      setError(t("簽名儲存失敗，請再試一次", "Could not save the signature — try again"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-3 flex items-center gap-1.5">
          <PenTool size={14} />
          {t("請將裝置交給客戶，於下方簽名確認", "Hand the device to the customer to sign below")}
        </p>
        <div className="h-40 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
          <SignatureCanvas
            ref={padRef}
            penColor="#334155"
            onEnd={() => setEmpty(padRef.current?.isEmpty() ?? true)}
            canvasProps={{ className: "w-full h-full" }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {t(
            "簽名將與時間戳記一併永久保存於此工作紀錄，事後無法修改或刪除",
            "The signature and timestamp are permanently saved with this job record and cannot be edited or deleted afterwards"
          )}
        </p>
        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear();
              setEmpty(true);
            }}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
          >
            {t("清除", "Clear")}
          </button>
          <button
            type="button"
            disabled={empty || busy}
            onClick={confirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              !empty && !busy ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-400"
            }`}
          >
            {busy ? t("儲存中…", "Saving…") : t("確認簽名", "Confirm signature")}
          </button>
        </div>
      </div>
    </div>
  );
}
