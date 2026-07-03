"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createJob } from "@/lib/actions/jobs";
import { useT } from "@/lib/i18n/provider";

/**
 * Job creation (spec §3.1). Estimated working time is captured as
 * structured hours (numeric input), not free text. Before-photos are
 * added on the job page right after creation.
 */
export function CreateJobModal({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    category: "water" as "water" | "electric",
    urgency: "normal" as "normal" | "urgent",
    description: "",
    estimatedHours: "",
    needsTruck: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createJob({
      companyId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerAddress: form.customerAddress,
      category: form.category,
      urgency: form.urgency,
      description: form.description,
      needsTruck: form.needsTruck,
      estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : null,
    });
    if (res.error || !res.id) {
      setError(t("建立失敗，請確認必填欄位", "Could not create the job — check the required fields"));
      setBusy(false);
      return;
    }
    onClose();
    router.push(`${window.location.pathname.startsWith("/worker") ? "/worker/jobs" : "/bo/jobs"}/${res.id}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Plus size={18} className="text-amber-500" />
            {t("建立案件", "Create Job")}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("客戶姓名", "Customer Name")}</label>
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("手機號碼", "Phone Number")}</label>
              <input
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                inputMode="tel"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("地址", "Address")}</label>
            <input
              value={form.customerAddress}
              onChange={(e) => setForm((f) => ({ ...f, customerAddress: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("類別", "Category")}</label>
              {/* 水 / 電 are separate categories, never combined (spec §3.1) */}
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "water" | "electric" }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="water">{t("水", "Water")}</option>
                <option value="electric">{t("電", "Electrical")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("緊急程度", "Urgency")}</label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as "normal" | "urgent" }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="normal">{t("一般", "Normal")}</option>
                <option value="urgent">{t("緊急", "Urgent")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("案件描述", "Description")}</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold text-slate-500">
                {t("預估工時（小時）", "Estimated Time (hours)")}
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.estimatedHours}
                onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
                placeholder={t("例：2 或 12（1.5 天）", "e.g. 2, or 12 (1.5 days)")}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 pb-2">
              <input
                type="checkbox"
                checked={form.needsTruck}
                onChange={(e) => setForm((f) => ({ ...f, needsTruck: e.target.checked }))}
                className="rounded"
              />
              {t("需要車輛", "Needs a truck")}
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            {t(
              "建立後即可在案件頁面上傳施工前照片。",
              "You can add before-photos on the job page right after creating it."
            )}
          </p>
        </div>
        {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold"
          >
            {t("取消", "Cancel")}
          </button>
          <button
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? t("建立中…", "Creating…") : t("建立案件", "Create Job")}
          </button>
        </div>
      </form>
    </div>
  );
}
