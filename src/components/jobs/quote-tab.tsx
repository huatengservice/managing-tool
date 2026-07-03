"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, PenTool, Plus, Share2, Trash2 } from "lucide-react";
import { SignaturePadModal } from "@/components/signature-pad-modal";
import { ShareModal } from "@/components/share-modal";
import {
  recordCustomerQuoteSignature, saveQuoteDraft, signQuoteAsBo,
} from "@/lib/actions/quotes";
import { uploadSignatureImage } from "@/lib/upload-signature";
import { ntd } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { Job, Quote, QuoteLineItem, Signature } from "@/lib/types";

interface EditableItem {
  description: string;
  qty: number;
  unitPrice: number;
}

/**
 * Quoting (spec §3.2): BO builds itemized line items, signs first
 * (authenticated in-app action), then the customer signs — device handoff
 * here, or remotely from their own account. Once signed, editing is
 * blocked server-side (spec §15.10), so the editor collapses to read-only.
 */
export function QuoteTab({
  job,
  quote,
  signatures,
  customerName,
}: {
  job: Job;
  quote: (Quote & { items: QuoteLineItem[] }) | null;
  signatures: Signature[];
  customerName: string;
}) {
  const t = useT();
  const router = useRouter();
  const locked = !!quote && quote.status !== "draft";
  const [items, setItems] = useState<EditableItem[]>(
    quote && quote.items.length > 0
      ? quote.items.map((li) => ({ description: li.description, qty: li.qty, unitPrice: li.unit_price }))
      : [{ description: "", qty: 1, unitPrice: 0 }]
  );
  const [showSign, setShowSign] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const boSig = signatures.find((s) => s.subject_type === "quote" && s.party === "bo");
  const customerSig = signatures.find((s) => s.subject_type === "quote" && s.party === "customer");
  const total = items.reduce((s, li) => s + li.qty * li.unitPrice, 0);

  function update(i: number, patch: Partial<EditableItem>) {
    setItems((list) => list.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  }

  async function saveAndSign() {
    setBusy(true);
    setError(null);
    const valid = items.filter((li) => li.description.trim() && li.qty > 0);
    if (valid.length === 0) {
      setError(t("請至少填寫一個項目", "Add at least one line item"));
      setBusy(false);
      return;
    }
    const saved = await saveQuoteDraft({ jobId: job.id, lineItems: valid });
    if (saved.error || !saved.id) {
      setError(t("儲存報價失敗", "Could not save the quote"));
      setBusy(false);
      return;
    }
    const signed = await signQuoteAsBo(saved.id);
    if (signed.error) {
      setError(t("簽署失敗", "Signing failed"));
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  async function customerSign(blob: Blob) {
    if (!quote) return;
    const imagePath = await uploadSignatureImage(job.company_id, job.id, blob);
    const res = await recordCustomerQuoteSignature({
      quoteId: quote.id,
      imagePath,
      signerName: customerName,
    });
    if (res.error) throw new Error(res.error);
    router.refresh();
  }

  const mechanismLabel = (s: Signature) =>
    s.mechanism === "device_handoff" ? t("裝置代簽", "device handoff") : t("帳戶遠端簽署", "remote account");

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-700">
          {locked
            ? quote?.status === "accepted"
              ? t("報價明細（已雙方簽署）", "Quote Details (Both Signed)")
              : t("報價明細（待客戶簽署）", "Quote Details (Awaiting Customer)")
            : t("建立報價", "Create Quote")}
        </h3>
        {!locked && (
          <span className="text-xs text-slate-400">
            {t("依案件描述與照片填寫項目", "Based on the job description and photos")}
          </span>
        )}
      </div>

      <table className="w-full text-sm mb-3">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left font-semibold py-2">{t("項目", "Item")}</th>
            <th className="text-right font-semibold py-2 w-20">{t("數量", "Qty")}</th>
            <th className="text-right font-semibold py-2 w-28">{t("單價", "Unit Price")}</th>
            <th className="text-right font-semibold py-2 w-28">{t("小計", "Subtotal")}</th>
            {!locked && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {items.map((li, i) => (
            <tr key={i} className="border-b border-slate-50">
              <td className="py-1.5 pr-2">
                {locked ? (
                  li.description
                ) : (
                  <input
                    value={li.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    placeholder={t("項目名稱", "Item name")}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                )}
              </td>
              <td className="py-1.5 text-right">
                {locked ? (
                  li.qty
                ) : (
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={li.qty}
                    onChange={(e) => update(i, { qty: Number(e.target.value) })}
                    className="w-16 border border-slate-200 rounded px-1.5 py-1 text-sm text-right"
                  />
                )}
              </td>
              <td className="py-1.5 text-right">
                {locked ? (
                  ntd(li.unitPrice)
                ) : (
                  <input
                    type="number"
                    min="0"
                    value={li.unitPrice}
                    onChange={(e) => update(i, { unitPrice: Number(e.target.value) })}
                    className="w-24 border border-slate-200 rounded px-1.5 py-1 text-sm text-right"
                  />
                )}
              </td>
              <td className="py-1.5 text-right font-medium">{ntd(li.qty * li.unitPrice)}</td>
              {!locked && (
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setItems((list) => list.filter((_, idx) => idx !== i))}
                    className="text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={locked ? 3 : 3} className="text-right font-bold pt-3">
              {t("總計", "Total")}
            </td>
            <td className="text-right font-bold pt-3">{ntd(total)}</td>
            {!locked && <td />}
          </tr>
        </tfoot>
      </table>

      {!locked && (
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { description: "", qty: 1, unitPrice: 0 }])}
          className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-lg px-3 py-1.5 mb-4 flex items-center gap-1"
        >
          <Plus size={12} />
          {t("新增項目", "Add Item")}
        </button>
      )}

      {/* Both mechanisms log identically: timestamp, party, mechanism (spec §3.2). */}
      <div className="bg-slate-50 rounded-lg p-3 text-xs mb-3">
        <p className="text-slate-500 mb-2 font-semibold">{t("雙方簽署紀錄", "Signature Log")}</p>
        <div className="flex flex-col gap-1.5">
          <span className={`flex items-center gap-1.5 ${boSig ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
            {boSig ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {boSig
              ? t(
                  `老闆已簽署（系統帳號認證，${new Date(boSig.signed_at).toLocaleString()}）`,
                  `Owner signed (authenticated account, ${new Date(boSig.signed_at).toLocaleString()})`
                )
              : t("老闆尚未簽署", "Owner has not signed")}
          </span>
          <span className={`flex items-center gap-1.5 ${customerSig ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
            {customerSig ? <CheckCircle2 size={13} /> : <Circle size={13} />}
            {customerSig
              ? t(
                  `客戶已簽署（${mechanismLabel(customerSig)}，${new Date(customerSig.signed_at).toLocaleString()}）`,
                  `Customer signed (${mechanismLabel(customerSig)}, ${new Date(customerSig.signed_at).toLocaleString()})`
                )
              : t("客戶尚未簽署", "Customer has not signed")}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

      <div className="flex gap-2 flex-wrap">
        {!locked && (
          <button
            onClick={saveAndSign}
            disabled={busy}
            className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            {busy ? t("處理中…", "Working…") : t("建立並簽署報價（老闆）", "Create & Sign Quote (Owner)")}
          </button>
        )}
        {quote?.status === "bo_signed" && (
          <button
            onClick={() => setShowSign(true)}
            className="text-sm border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg px-4 py-2 font-semibold flex items-center gap-1.5"
          >
            <PenTool size={14} />
            {t("請客戶於此裝置簽署", "Have Customer Sign on This Device")}
          </button>
        )}
        {quote && (
          <button
            onClick={() => setShowShare(true)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Share2 size={14} />
            {t("分享報價單", "Share Quote")}
          </button>
        )}
      </div>
      {quote?.status === "bo_signed" && (
        <p className="text-[11px] text-slate-400 mt-2">
          {t(
            "客戶若已建立帳戶，也可透過分享連結或客戶入口網頁遠端簽署。",
            "If the customer has an account, they can also sign remotely from the shared link or their portal."
          )}
        </p>
      )}

      {showSign && (
        <SignaturePadModal
          title={t("客戶簽署報價單", "Customer Quote Signature")}
          onConfirm={customerSign}
          onClose={() => setShowSign(false)}
        />
      )}
      {showShare && quote && (
        <ShareModal
          title={t("分享報價單", "Share Quote")}
          subjectType="quote"
          subjectId={quote.id}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
