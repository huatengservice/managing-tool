"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Camera, CheckCircle2, Circle, MapPin,
  PenTool, Phone, Play, QrCode, Truck, XCircle,
} from "lucide-react";
import { Stepper } from "@/components/jobs/stepper";
import { UrgencyTag, CategoryBadge } from "@/components/jobs/badges";
import { PhotoUploadGrid } from "@/components/photo-upload-grid";
import { SignaturePadModal } from "@/components/signature-pad-modal";
import { QuoteTab } from "@/components/jobs/quote-tab";
import { InvoiceTab } from "@/components/jobs/invoice-tab";
import { cancelJob, setDisputed, startWork, updateJobWork } from "@/lib/actions/jobs";
import {
  recordCustomerCompletionSignature, signCompletionAsStaff,
} from "@/lib/actions/quotes";
import { createCustomerSignupLink } from "@/lib/actions/customers";
import { uploadSignatureImage } from "@/lib/upload-signature";
import { formatHours } from "@/lib/format";
import { formatPhone } from "@/lib/auth/phone";
import { useLang, useT } from "@/lib/i18n/provider";
import type { JobDetailData } from "@/lib/job-detail-data";
import QRCode from "qrcode";

export function JobDetailClient({
  data,
  asWorker,
  backHref,
}: {
  data: JobDetailData;
  asWorker: boolean;
  backHref: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const { job, customer, photos, quote, signatures, invoice, workerNames } = data;
  const [tab, setTab] = useState<"overview" | "quote" | "invoice">("overview");
  const [showCompletionSign, setShowCompletionSign] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actualHours, setActualHours] = useState(job.actual_hours?.toString() ?? "");
  const [varianceNote, setVarianceNote] = useState(job.variance_note ?? "");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const beforePhotos = photos.filter((p) => p.type === "before");
  const afterPhotos = photos.filter((p) => p.type === "after");
  const completionStaffSig = signatures.find(
    (s) => s.subject_type === "completion" && s.party !== "customer"
  );
  const completionCustomerSig = signatures.find(
    (s) => s.subject_type === "completion" && s.party === "customer"
  );
  const workDone = ["work_done", "invoiced", "paid"].includes(job.status);
  const cancelled = job.status === "cancelled";
  const quoteTotal = quote ? quote.items.reduce((s, li) => s + li.qty * li.unit_price, 0) : 0;

  async function saveWorkLog() {
    const res = await updateJobWork({
      jobId: job.id,
      actualHours: actualHours ? Number(actualHours) : null,
      varianceNote: varianceNote || null,
    });
    setFlash(res.error ? t("儲存失敗", "Save failed") : t("已儲存 ✓", "Saved ✓"));
    setTimeout(() => setFlash(null), 2000);
    router.refresh();
  }

  async function customerSignCompletion(blob: Blob) {
    const imagePath = await uploadSignatureImage(job.company_id, job.id, blob);
    const res = await recordCustomerCompletionSignature({
      jobId: job.id,
      imagePath,
      signerName: customer.name,
    });
    if (res.error) throw new Error(res.error);
    router.refresh();
  }

  async function showCustomerQr() {
    const res = await createCustomerSignupLink(customer.id);
    if (res.url) {
      setQrDataUrl(await QRCode.toDataURL(res.url, { width: 480, margin: 1 }));
    }
  }

  return (
    <div>
      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft size={15} />
        {t("返回", "Back")}
      </Link>

      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800">{customer.name}</h2>
            <span className="text-xs font-mono text-slate-400">{job.code}</span>
            <CategoryBadge category={job.category} />
            <UrgencyTag urgency={job.urgency} />
            {job.disputed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs font-semibold">
                <AlertTriangle size={11} />
                {t("糾紛處理中", "Disputed")}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {customer.address}
            </span>
            <span className="flex items-center gap-1">
              <Phone size={13} />
              {formatPhone(customer.phone)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {job.needs_truck && (
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2.5 py-1 text-xs font-semibold">
              <Truck size={13} />
              {t("需要車輛", "Needs Truck")}
            </span>
          )}
          <button
            onClick={showCustomerQr}
            className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <QrCode size={13} />
            {t("客戶帳戶 QR", "Customer Account QR")}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <Stepper status={job.status} />
        {cancelled && job.cancellation_reason && (
          <p className="text-xs text-rose-500 mt-2">
            {t("取消原因", "Cancellation reason")}：{job.cancellation_reason}
          </p>
        )}
      </div>

      {!asWorker && !cancelled && (
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {(
            [
              ["overview", t("案件詳情", "Details")],
              ["quote", t("報價", "Quote")],
              ["invoice", t("帳單", "Invoice")],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
                tab === k
                  ? "border-amber-500 text-slate-800"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {(tab === "overview" || asWorker || cancelled) && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t("案件描述", "Job Description")}</h3>
            <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{job.description}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">{t("預估工時", "Estimated Time")}</span>
                {formatHours(job.estimated_hours, lang)}
              </div>
              <div>
                <span className="text-xs text-slate-400 block">{t("實際工時", "Actual Time")}</span>
                {formatHours(job.actual_hours, lang)}
              </div>
              {workerNames.length > 0 && (
                <div className="col-span-2">
                  <span className="text-xs text-slate-400 block">{t("排定師傅", "Scheduled workers")}</span>
                  {workerNames.join("、")}
                </div>
              )}
            </div>

            {!workDone && !cancelled && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500">
                  {t("回報實際工時", "Report actual working time")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                    placeholder={t("實際小時數", "Actual hours")}
                    className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={saveWorkLog}
                    className="text-xs font-semibold border border-slate-200 rounded-lg px-3 hover:bg-slate-50"
                  >
                    {flash ?? t("儲存", "Save")}
                  </button>
                </div>
                {actualHours && job.estimated_hours && Number(actualHours) !== Number(job.estimated_hours) && (
                  <textarea
                    rows={2}
                    value={varianceNote}
                    onChange={(e) => setVarianceNote(e.target.value)}
                    placeholder={t(
                      "工時差異說明（選填）：為什麼與預估不同？",
                      "Variance note (optional): why did it differ from the estimate?"
                    )}
                    className="w-full border border-amber-200 bg-amber-50/50 rounded-lg px-3 py-2 text-xs"
                  />
                )}
              </div>
            )}
            {workDone && job.variance_note && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-700">
                {t("工時差異說明", "Variance note")}：{job.variance_note}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <Camera size={15} />
              {t("照片紀錄", "Photos")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <PhotoUploadGrid
                label={t("施工前", "Before")}
                photos={beforePhotos}
                jobId={job.id}
                companyId={job.company_id}
                photoType="before"
                allowUpload={!workDone && !cancelled}
              />
              <PhotoUploadGrid
                label={t("施工後", "After")}
                photos={afterPhotos}
                jobId={job.id}
                companyId={job.company_id}
                photoType="after"
                allowUpload={!workDone && !cancelled}
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              {t(
                "照片上傳時自動壓縮並校正方向；拍攝時間與地點會以結構化欄位保留於系統作為留存證據，但任何透過「分享」送出的內容都不含這些資訊，避免外流客戶地址。",
                "Photos are auto-compressed and orientation-corrected on upload; capture time and location are kept as structured fields for dispute evidence, but nothing sent via Share ever includes them."
              )}
            </p>
          </div>
        </div>
      )}

      {tab === "quote" && !asWorker && !cancelled && (
        <QuoteTab job={job} quote={quote} signatures={signatures} customerName={customer.name} />
      )}

      {tab === "invoice" && !asWorker && !cancelled && (
        <InvoiceTab job={job} invoice={invoice} quoteTotal={quoteTotal} workDone={workDone} />
      )}

      {/* ---------- completion sign-off (spec §3.5): staff first, customer second ---------- */}
      {!workDone && !cancelled && ["accepted", "in_progress"].includes(job.status) && (tab === "overview" || asWorker) && (
        <div className="mt-5 bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 font-semibold">{t("完工雙方簽署", "Completion Sign-Off")}</p>
          <div className="flex flex-col gap-1.5 text-xs mb-3">
            <span className={`flex items-center gap-1.5 ${completionStaffSig ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
              {completionStaffSig ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              {t("施工人員已確認完工", "Worker confirmed completion")}
              {completionStaffSig && (
                <span className="text-slate-400 font-normal">
                  {new Date(completionStaffSig.signed_at).toLocaleString()}
                </span>
              )}
            </span>
            <span className={`flex items-center gap-1.5 ${completionCustomerSig ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
              {completionCustomerSig ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              {t("客戶已簽署確認", "Customer signed off")}
            </span>
          </div>

          {job.status === "accepted" && (
            <button
              onClick={async () => {
                await startWork(job.id);
                router.refresh();
              }}
              className="w-full mb-2 border border-amber-300 bg-amber-50 text-amber-700 font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 hover:bg-amber-100 text-sm"
            >
              <Play size={15} />
              {t("開始施工（進行中）", "Start Work (In Progress)")}
            </button>
          )}

          {!completionStaffSig && (
            <>
              <button
                disabled={afterPhotos.length === 0}
                onClick={async () => {
                  const res = await signCompletionAsStaff(job.id);
                  if (res.error) setFlash(t("簽署失敗", "Sign failed"));
                  router.refresh();
                }}
                className={`w-full font-semibold rounded-xl py-3 flex items-center justify-center gap-2 text-sm ${
                  afterPhotos.length > 0
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                <CheckCircle2 size={16} />
                {t("確認完工（本人簽署）", "Confirm Completion (Sign Yourself)")}
              </button>
              {afterPhotos.length === 0 && (
                <p className="text-[11px] text-rose-400 mt-2 text-center">
                  {t(
                    "請先於上方上傳至少一張施工後照片才能標記完工",
                    "Upload at least one after photo above before marking this complete"
                  )}
                </p>
              )}
            </>
          )}
          {completionStaffSig && !completionCustomerSig && (
            <button
              onClick={() => setShowCompletionSign(true)}
              className="w-full bg-amber-500 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-amber-600 text-sm"
            >
              <PenTool size={16} />
              {t("請客戶於此裝置簽署確認", "Have Customer Sign on This Device")}
            </button>
          )}
        </div>
      )}

      {/* ---------- BO-only side-state controls (spec §4) ---------- */}
      {!asWorker && !cancelled && job.status !== "paid" && (
        <div className="mt-5 flex gap-2 justify-end">
          <button
            onClick={async () => {
              await setDisputed(job.id, !job.disputed);
              router.refresh();
            }}
            className="text-xs text-slate-400 hover:text-orange-600 flex items-center gap-1"
          >
            <AlertTriangle size={12} />
            {job.disputed ? t("解除糾紛標記", "Clear dispute flag") : t("標記為糾紛案件", "Flag as disputed")}
          </button>
          <button
            onClick={() => setShowCancel(true)}
            className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1"
          >
            <XCircle size={12} />
            {t("取消案件", "Cancel job")}
          </button>
        </div>
      )}

      {showCompletionSign && (
        <SignaturePadModal
          title={t("客戶簽署完工確認", "Customer Completion Sign-Off")}
          onConfirm={customerSignCompletion}
          onClose={() => setShowCompletionSign(false)}
        />
      )}

      {showCancel && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-800 mb-2">{t("取消案件", "Cancel Job")}</h3>
            <p className="text-xs text-slate-400 mb-3">
              {t("取消需填寫原因，並會記錄操作人與時間。", "A reason is required; who cancelled and when is logged.")}
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t("取消原因…", "Reason…")}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancel(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
              >
                {t("返回", "Back")}
              </button>
              <button
                disabled={!cancelReason.trim()}
                onClick={async () => {
                  await cancelJob(job.id, cancelReason);
                  setShowCancel(false);
                  router.refresh();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {t("確認取消案件", "Confirm Cancellation")}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrDataUrl && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4" onClick={() => setQrDataUrl(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-1">{t("客戶帳戶註冊 QR", "Customer Signup QR")}</h3>
            <p className="text-xs text-slate-400 mb-3 max-w-[240px]">
              {t(
                "請客戶用手機相機掃描。連結綁定此客戶，24 小時內有效、僅能使用一次。",
                "Have the customer scan with their phone camera. The link is tied to this customer, valid 24h, single-use."
              )}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR code" className="w-56 h-56 mx-auto" />
            <button onClick={() => setQrDataUrl(null)} className="mt-2 text-xs text-slate-400">
              {t("關閉", "Close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
