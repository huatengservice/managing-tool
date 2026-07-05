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
 * Invoicing (spec §3.6, BO-only): official e-invoice (統一發票) or informal
 * receipt; payment by card online (customer side) or manual cash/transfer
 * marking here. Share link + downloadable PDF.
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
  const [type, setType] = useState<"einvoice" | "receipt">(invoice?.type ?? "einvoice");
  const [buyerUbn, setBuyerUbn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [markMethod, setMarkMethod] = useState<"cash" | "transfer">("cash");

  async function issue() {
    setBusy(true);
    setError(null);
    const res = await issueInvoice({ jobId: job.id, type, buyerUbn: buyerUbn.trim() || null });
    if (res.error) {
      setError(
        res.error === "plan_no_einvoice"
          ? t("目前方案不含電子發票，請至「方案與帳單」升級", "Your plan doesn't include e-invoices — upgrade under Plan & Billing")
          : res.error === "einvoice_not_configured"
            ? t("電子發票金鑰尚未設定（EZPAY_INVOICE_*）", "E-invoice credentials are not configured (EZPAY_INVOICE_*)")
            : res.error === "no_accepted_quote"
              ? t("需先有客戶已簽署的報價單", "A customer-signed quote is required first")
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
          {t("建立帳單", "Create Invoice")}
        </h3>
        <p className="text-sm text-slate-400">
          {t(
            "工作完成並經雙方簽署後即可開立帳單。",
            "You can issue an invoice once the work is done and both parties have signed off."
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
        <DollarSign size={15} />
        {invoice ? t("帳單", "Invoice") : t("建立帳單", "Create Invoice")}
      </h3>

      {!invoice ? (
        <>
          <p className="text-xs text-slate-400 mb-3">
            {t(
              `金額取自已簽署的報價單，總計 ${ntd(quoteTotal)}`,
              `Amount from the signed quote, total ${ntd(quoteTotal)}`
            )}
          </p>
          <div className="flex gap-3 mb-4">
            <label
              className={`flex-1 rounded-xl p-3 text-sm cursor-pointer border-2 ${
                type === "einvoice" ? "border-amber-400 bg-amber-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                checked={type === "einvoice"}
                onChange={() => setType("einvoice")}
                className="mr-2"
              />
              {t("正式電子發票（統一發票）", "Official E-Invoice")}
            </label>
            <label
              className={`flex-1 rounded-xl p-3 text-sm cursor-pointer border-2 ${
                type === "receipt" ? "border-amber-400 bg-amber-50" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                checked={type === "receipt"}
                onChange={() => setType("receipt")}
                className="mr-2"
              />
              {t("一般收據", "Informal Receipt")}
            </label>
          </div>
          {type === "einvoice" && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500">
                {t("買受人統一編號（選填，B2B 發票用）", "Buyer Tax ID (optional, for B2B invoices)")}
              </label>
              <input
                value={buyerUbn}
                onChange={(e) => setBuyerUbn(e.target.value)}
                inputMode="numeric"
                className="mt-1 w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
          <button
            onClick={issue}
            disabled={busy}
            className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            {busy ? t("開立中…", "Issuing…") : t("開立帳單", "Issue Invoice")}
          </button>
        </>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-xs text-slate-400 block">{t("單號", "Number")}</span>
              <span className="font-mono">{invoice.number}</span>
              {invoice.einvoice_number && (
                <span className="block text-xs text-slate-500 mt-1">
                  {t("發票號碼", "E-invoice No.")}：{invoice.einvoice_number}
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
            <div className="flex items-center gap-2 mb-4">
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
              {t("分享帳單", "Share Invoice")}
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
          title={t("分享帳單", "Share Invoice")}
          subjectType="invoice"
          subjectId={invoice.id}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
