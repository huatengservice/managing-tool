"use client";

import { useEffect, useState } from "react";
import { Share2, X } from "lucide-react";
import { createShareLink } from "@/lib/actions/share";
import { useT } from "@/lib/i18n/provider";

export function ShareModal({
  title,
  subjectType,
  subjectId,
  onClose,
}: {
  title: string;
  subjectType: "quote" | "invoice";
  subjectId: string;
  onClose: () => void;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    createShareLink({ subjectType, subjectId }).then((res) => {
      if (res.url) setUrl(res.url);
      else setError(true);
    });
  }, [subjectType, subjectId]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function nativeShare() {
    if (!url) return;
    if (navigator.share) {
      // Web Share API — the device's own share sheet (LINE, SMS, …); no
      // messaging integration needed (spec §3.6).
      await navigator.share({ title, url }).catch(() => {});
    } else {
      await copy();
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Share2 size={18} className="text-amber-500" />
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          {t(
            "此連結為唯讀、無法猜測的安全連結，30 天後自動失效；不包含照片的地點與時間中繼資料。",
            "This is a read-only, unguessable link that expires after 30 days; it carries no photo location/timestamp metadata."
          )}
        </p>
        {error ? (
          <p className="text-sm text-rose-500">{t("無法產生連結，請再試一次", "Could not create the link — try again")}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
              <span className="flex-1 text-xs font-mono text-slate-600 truncate">
                {url ?? t("產生中…", "Generating…")}
              </span>
              <button
                onClick={copy}
                disabled={!url}
                className="text-xs font-semibold text-amber-600 flex-shrink-0 disabled:opacity-50"
              >
                {copied ? t("已複製 ✓", "Copied ✓") : t("複製", "Copy")}
              </button>
            </div>
            <button
              onClick={nativeShare}
              disabled={!url}
              className="w-full text-sm border border-slate-200 rounded-lg py-2.5 flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-50"
            >
              <Share2 size={14} />
              {t("透過裝置分享功能傳送（LINE、簡訊等）", "Send via device share sheet (LINE, SMS, etc.)")}
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full mt-3 text-xs text-slate-400">
          {t("關閉", "Close")}
        </button>
      </div>
    </div>
  );
}
