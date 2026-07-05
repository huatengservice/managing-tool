"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Phone, QrCode, UserCircle, X } from "lucide-react";
import QRCode from "qrcode";
import { StageBadge } from "@/components/jobs/badges";
import { TagEditor } from "@/components/tag-editor";
import { createCustomerSignupLink, saveCustomerTags } from "@/lib/actions/customers";
import { formatPhone } from "@/lib/auth/phone";
import { useT } from "@/lib/i18n/provider";
import type { JobStatus } from "@/lib/types";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  tags: string[];
  hasAccount: boolean;
  jobs: { id: string; code: string; description: string; status: JobStatus }[];
}

/**
 * Customers directory (spec §6): one row per customer, expandable to the
 * BO's private structured tags — this is where private notes live, not
 * buried in job tabs — plus full job history and the QR opt-in entry.
 */
export function CustomersClient({
  customers,
  companyId,
}: {
  customers: CustomerRow[];
  companyId: string;
}) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tagState, setTagState] = useState<Record<string, string[]>>(
    Object.fromEntries(customers.map((c) => [c.id, c.tags]))
  );
  const [qr, setQr] = useState<{ name: string; dataUrl: string } | null>(null);

  async function updateTags(customerId: string, tags: string[]) {
    setTagState((s) => ({ ...s, [customerId]: tags }));
    await saveCustomerTags({ customerId, companyId, tags });
  }

  async function showQr(c: CustomerRow) {
    const res = await createCustomerSignupLink(c.id);
    if (res.url) {
      setQr({ name: c.name, dataUrl: await QRCode.toDataURL(res.url, { width: 480, margin: 1 }) });
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">{t("客戶", "Customers")}</h2>
      <p className="text-sm text-slate-500 mb-5 flex items-center gap-1">
        <Lock size={12} />
        {t(
          "私人備註僅老闆可見，客戶與師傅皆看不到",
          "Private notes are visible only to the owner — never to customers or workers"
        )}
      </p>
      <div className="space-y-3">
        {customers.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <UserCircle size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    {c.name}
                    {c.hasAccount && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-1.5 py-0.5">
                        {t("已開通帳戶", "Has account")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Phone size={11} />
                    {formatPhone(c.phone)} · {t(`${c.jobs.length} 筆案件`, `${c.jobs.length} jobs`)}
                  </p>
                </div>
              </div>
              <ChevronRight
                size={16}
                className={`text-slate-300 transition ${openId === c.id ? "rotate-90" : ""}`}
              />
            </button>
            {openId === c.id && (
              <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Lock size={11} />
                    {t("私人備註（結構化標籤）", "Private Notes (structured tags)")}
                  </p>
                  {!c.hasAccount && (
                    <button
                      onClick={() => showQr(c)}
                      className="text-xs text-slate-500 hover:text-amber-600 flex items-center gap-1"
                    >
                      <QrCode size={12} />
                      {t("產生客戶帳戶 QR", "Customer account QR")}
                    </button>
                  )}
                </div>
                <div className="mb-4">
                  <TagEditor
                    tags={tagState[c.id] ?? []}
                    onChange={(tags) => updateTags(c.id, tags)}
                  />
                </div>
                <p className="text-xs font-semibold text-slate-500 mb-2">{t("案件紀錄", "Job History")}</p>
                <div className="space-y-1.5">
                  {c.jobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/bo/jobs/${j.id}`}
                      className="flex items-center justify-between text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-amber-300"
                    >
                      <span className="text-slate-600 flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{j.code}</span>
                        <span className="line-clamp-1">{j.description}</span>
                      </span>
                      <StageBadge status={j.status} />
                    </Link>
                  ))}
                  {c.jobs.length === 0 && (
                    <p className="text-xs text-slate-300">{t("尚無案件", "No jobs yet")}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {customers.length === 0 && (
          <p className="text-sm text-slate-300 text-center py-10">
            {t("建立第一筆案件後，客戶會自動出現在這裡", "Customers appear here once you create your first job")}
          </p>
        )}
      </div>

      {qr && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4" onClick={() => setQr(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setQr(null)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-500">
              <X size={18} />
            </button>
            <h3 className="font-bold text-slate-800 mb-1">{qr.name}</h3>
            <p className="text-xs text-slate-400 mb-3 max-w-[240px]">
              {t(
                "請客戶用手機相機掃描此 QR，即可用預填的手機號碼建立帳戶並查看完整服務紀錄。24 小時內有效、僅能使用一次。",
                "Have the customer scan this with their phone camera to create an account (phone pre-filled) and see their full history. Valid 24h, single-use."
              )}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.dataUrl} alt="QR code" className="w-56 h-56 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}
