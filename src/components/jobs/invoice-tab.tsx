"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, DollarSign, Download, Share2 } from "lucide-react";
import { ShareModal } from "@/components/share-modal";
import { issueInvoice, markInvoicePaid } from "@/lib/actions/invoices";
import { ntd } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { Invoice, Job } from "@/lib/types";

/**
 * Billing (spec §3.6, BO-only). The billing document is the informal
 * receipt (免用統一發票收據) — e-invoice was deferred by owner decision.
 * Payment: card online (customer side) or manual cash/transfer marking.
 */
export function InvoiceTab({
  job,
  invoice,
  quoteTotal,
  workDone,
}: {
  job: Job;
  invoice: Invoice | null;
  quoteTotal: number;
  workDone: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [buyerUbn, setBuyerUbn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [markMethod, setMarkMethod] = useState<"cash" | "transfer">("cash");

  async function issue() {
    setBusy(true);
    setError(null);
    const res = await issueInvoice({ jobId: job.id, buyerUbn: buyerUbn.trim() || null });
    if (res.error) {
      setError(
        res.error === "no_accepted_quote"
          ? t("需先有客戶已簽署的報價單", "A customer-signed quote is required first")
          : res.error === "invalid_ubn"
            ? t("統一編號須為 8 位數字", "Tax ID must be 8 digits")
            : t("開立失敗，請再試一次", "Issuing failed — try again")
      );
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function markPaid() {
    if (!invoice) return;
    setBusy(true);
    const res = await markInvoicePaid({ invoiceId: invoice.id, method: markMethod });
    if (res.error) setError(t("標記失敗", "Could not mark as paid"));
    router.refresh();
    setBusy(false);
  }

  if (!workDone && !invoice) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
          <DollarSign size={15} />
          {t("開立收據", "Issue Receipt")}
        </h3>
        <p className="text-sm text-slate-400">
          {t(
            "工作完成並經雙方簽署後即可開立收據。",
            "You can issue a receipt once the work is done and both parties have signed off."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
        <DollarSign size={15} />
        {invoice ? t("收據", "Receipt") : t("開立收據", "Issue Receipt")}
      </h3>

      {!invoice ? (
        <>
          <p className="text-xs text-slate-400 mb-3">
            {t(
              `金額取自已簽署的報價單，總計 ${ntd(quoteTotal)}。開立「免用統一發票收據」，可下載 PDF 或分享連結給客戶。`,
              `Amount from the signed quote, total ${ntd(quoteTotal)}. Issues an informal receipt (免用統一發票收據) with PDF download and share link.`
            )}
          </p>
          <div className="mb-4">
            <label className="text-xs font-semibold text-slate-500">
              {t("買受人統一編號（選填，公司客戶報帳用）", "Buyer Tax ID (optional, for business customers)")}
            </label>
            <input
              value={buyerUbn}
              onChange={(e) => setBuyerUbn(e.target.value)}
              inputMode="numeric"
              maxLength={8}
              className="mt-1 w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
          <button
            onClick={issue}
            disabled={busy}
            className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            {busy ? t("開立中…", "Issuing…") : t("開立收據", "Issue Receipt")}
          </button>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-xs text-slate-400 block">{t("收據編號", "Receipt No.")}</span>
              <span className="font-mono">{invoice.number}</span>
              {invoice.buyer_ubn && (
                <span className="block text-xs text-slate-500 mt-1">
                  {t("買受人統編", "Buyer Tax ID")}：{invoice.buyer_ubn}
                </span>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-xs text-slate-400 block">{t("金額", "Amount")}</span>
              <span className="font-bold">{ntd(invoice.amount)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-4">
            <span className="text-sm text-slate-600">{t("付款狀態", "Payment Status")}</span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                invoice.status === "paid"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {invoice.status === "paid"
                ? t(
                    `已付款（${invoice.payment_method === "card" ? "信用卡" : invoice.payment_method === "cash" ? "現金" : "轉帳"}）`,
                    `Paid (${invoice.payment_method})`
                  )
                : t("尚未付款", "Unpaid")}
            </span>
          </div>

          {invoice.status === "unpaid" && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <select
                value={markMethod}
                onChange={(e) => setMarkMethod(e.target.value as "cash" | "transfer")}
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
              >
                <option value="cash">{t("現金", "Cash")}</option>
                <option value="transfer">{t("轉帳", "Bank transfer")}</option>
              </select>
              <button
                onClick={markPaid}
                disabled={busy}
                className="text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                {t("標記為已收款", "Mark as Paid")}
              </button>
              <span className="text-[11px] text-slate-400">
                {t("信用卡付款由客戶透過分享連結完成，系統自動核銷。", "Card payments happen on the shared link and reconcile automatically.")}
              </span>
            </div>
          )}

          {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowShare(true)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Share2 size={14} />
              {t("分享收據", "Share Receipt")}
            </button>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Download size={14} />
              {t("下載 PDF", "Download PDF")}
            </a>
          </div>
        </>
      )}

      {showShare && invoice && (
        <ShareModal
          title={t("分享收據", "Share Receipt")}
          subjectType="invoice"
          subjectId={invoice.id}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
