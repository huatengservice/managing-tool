"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Lock, LogOut, PenTool } from "lucide-react";
import { StageBadge } from "@/components/jobs/badges";
import { signOut } from "@/app/auth/actions";
import {
  customerSignCompletionRemotely, customerSignQuoteRemotely, saveCustomerPrivateNote,
} from "@/lib/actions/customer-auth";
import { ntd } from "@/lib/format";
import { LanguageToggle, useT } from "@/lib/i18n/provider";
import type { Invoice, JobStatus, QuoteLineItem, QuoteStatus, Signature } from "@/lib/types";

export interface PortalJob {
  id: string;
  code: string;
  status: JobStatus;
  description: string;
  companyName: string;
  total: number;
  quote: { id: string; status: QuoteStatus; items: QuoteLineItem[] } | null;
  invoice: Invoice | null;
  signatures: Signature[];
  note: string;
  photos: { id: string; type: "before" | "after"; url: string }[];
}

export function PortalClient({ jobs }: { jobs: PortalJob[] }) {
  const t = useT();
  const companyName = jobs[0]?.companyName;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-slate-800">{t("我的服務紀錄", "My Service History")}</h1>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button onClick={() => signOut()} className="text-slate-400 hover:text-slate-600">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        {companyName && (
          <p className="text-sm text-slate-500 mb-5">
            {t(`與 ${companyName} 的完整往來紀錄`, `Your full history with ${companyName}`)}
          </p>
        )}

        <div className="space-y-4">
          {jobs.map((job) => (
            <PortalJobCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <p className="text-center text-sm text-slate-300 py-10">
              {t("尚無服務紀錄", "No service records yet")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PortalJobCard({ job }: { job: PortalJob }) {
  const t = useT();
  const router = useRouter();
  const [note, setNote] = useState(job.note);
  const [noteSaved, setNoteSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffCompletionSigned = job.signatures.some(
    (s) => s.subject_type === "completion" && s.party !== "customer"
  );
  const customerCompletionSigned = job.signatures.some(
    (s) => s.subject_type === "completion" && s.party === "customer"
  );
  const quoteAwaitingCustomer = job.quote?.status === "bo_signed";
  const completionAwaitingCustomer =
    staffCompletionSigned &&
    !customerCompletionSigned &&
    ["accepted", "in_progress"].includes(job.status);

  async function signQuote() {
    if (!job.quote) return;
    setBusy(true);
    setError(null);
    const res = await customerSignQuoteRemotely(job.quote.id);
    if (res.error) setError(t("簽署失敗，請再試一次", "Signing failed — try again"));
    router.refresh();
    setBusy(false);
  }

  async function signCompletion() {
    setBusy(true);
    setError(null);
    const res = await customerSignCompletionRemotely(job.id);
    if (res.error) setError(t("簽署失敗，請再試一次", "Signing failed — try again"));
    router.refresh();
    setBusy(false);
  }

  async function saveNote() {
    await saveCustomerPrivateNote({ jobId: job.id, note });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-slate-800 text-sm">{job.description}</span>
        <StageBadge status={job.status} />
      </div>
      <p className="text-xs font-mono text-slate-300 mb-3">{job.code}</p>

      {job.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {job.photos.slice(0, 6).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="relative h-20 rounded-lg overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                {p.type === "before" ? t("施工前", "Before") : t("施工後", "After")}
              </span>
            </a>
          ))}
        </div>
      )}

      {job.quote && job.quote.items.length > 0 && (
        <div className="border border-slate-100 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">{t("報價明細", "Quote")}</p>
          {job.quote.items.map((li) => (
            <div key={li.id} className="flex justify-between text-xs text-slate-600 py-0.5">
              <span>
                {li.description} × {li.qty}
              </span>
              <span>{ntd(li.qty * li.unit_price)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 mt-2 pt-2">
            <span>{t("總金額", "Total")}</span>
            <span>{ntd(job.total)}</span>
          </div>
        </div>
      )}

      {quoteAwaitingCustomer && (
        <button
          onClick={signQuote}
          disabled={busy}
          className="w-full mb-3 bg-amber-500 text-white font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 hover:bg-amber-600 text-sm disabled:opacity-60"
        >
          <PenTool size={15} />
          {t("同意並簽署此報價", "Accept & Sign This Quote")}
        </button>
      )}
      {completionAwaitingCustomer && (
        <button
          onClick={signCompletion}
          disabled={busy}
          className="w-full mb-3 bg-emerald-600 text-white font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 hover:bg-emerald-700 text-sm disabled:opacity-60"
        >
          <CheckCircle2 size={15} />
          {t("確認完工並簽署", "Confirm Completion & Sign")}
        </button>
      )}
      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

      {job.invoice && (
        <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 mb-3 text-sm">
          <span className="text-slate-600">
            {t("收據", "Receipt")}{" "}
            <span className="font-mono text-xs text-slate-400">{job.invoice.number}</span>
          </span>
          {job.invoice.status === "paid" ? (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              {t("已付款", "Paid")}
            </span>
          ) : (
            <a
              href={`/pay/${job.invoice.id}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white flex items-center gap-1.5"
            >
              <CreditCard size={12} />
              {t(`線上付款 ${ntd(job.invoice.amount)}`, `Pay ${ntd(job.invoice.amount)} online`)}
            </a>
          )}
        </div>
      )}

      {/* Private layer #3: the customer's own note — never visible to BO/Worker */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
          <Lock size={11} />
          {t("我的私人筆記（僅您可見）", "My private note (visible only to you)")}
          {noteSaved && <span className="text-emerald-600">✓</span>}
        </p>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder={t("例：下次記得問保固期限…", "e.g. remember to ask about the warranty…")}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
