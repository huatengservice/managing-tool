"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { addMaterial, deleteMaterial } from "@/lib/actions/materials";
import { ntd } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export interface MaterialRow {
  id: string;
  purchased_on: string;
  supplier: string;
  item: string;
  qty: number;
  unit_price: number;
  job_id: string | null;
  jobs: { code: string } | null;
}

type Preset = "week" | "month" | "lastMonth" | "custom";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  if (p === "week") {
    const day = (now.getDay() + 6) % 7; // Monday start
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [isoDate(start), isoDate(end)];
  }
  if (p === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return [isoDate(start), isoDate(end)];
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [isoDate(start), isoDate(end)];
}

/**
 * Materials purchase log (spec §6): filterable by supplier AND date range
 * (this week / this month / last month / custom) — built for cross-checking
 * a supplier's month-end bill against what was actually bought.
 */
export function MaterialsClient({
  materials,
  jobs,
  companyId,
}: {
  materials: MaterialRow[];
  jobs: { id: string; code: string; description: string }[];
  companyId: string;
}) {
  const t = useT();
  const router = useRouter();
  const suppliers = useMemo(
    () => Array.from(new Set(materials.map((m) => m.supplier))),
    [materials]
  );
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("month");
  const [[startDate, endDate], setRange] = useState<[string, string]>(presetRange("month"));
  const [showAdd, setShowAdd] = useState(false);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  }

  const rows = materials.filter((m) => {
    const supplierMatch = !supplierFilter || m.supplier === supplierFilter;
    const dateMatch = m.purchased_on >= startDate && m.purchased_on <= endDate;
    return supplierMatch && dateMatch;
  });
  const total = rows.reduce((s, m) => s + m.qty * m.unit_price, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("材料採購紀錄", "Materials Purchase Log")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("月底核對材料行請款金額是否正確", "Cross-check suppliers' month-end bills")}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"
        >
          <Plus size={16} />
          {t("新增採購紀錄", "Add Purchase")}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 w-16">{t("期間：", "Period:")}</span>
          {(
            [
              ["week", t("本週", "This week")],
              ["month", t("本月", "This month")],
              ["lastMonth", t("上月", "Last month")],
              ["custom", t("自訂", "Custom")],
            ] as [Preset, string][]
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                preset === p ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setRange([e.target.value, endDate])}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <span className="text-slate-400 text-sm">{t("至", "to")}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setRange([startDate, e.target.value])}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 w-16">{t("供應商：", "Supplier:")}</span>
          <button
            onClick={() => setSupplierFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full ${
              !supplierFilter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {t("全部", "All")}
          </button>
          {suppliers.map((s) => (
            <button
              key={s}
              onClick={() => setSupplierFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full ${
                supplierFilter === s ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left font-semibold px-4 py-3">{t("日期", "Date")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("供應商", "Supplier")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("項目", "Item")}</th>
              <th className="text-right font-semibold px-4 py-3">{t("數量", "Qty")}</th>
              <th className="text-right font-semibold px-4 py-3">{t("單價", "Unit Price")}</th>
              <th className="text-right font-semibold px-4 py-3">{t("小計", "Subtotal")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("關聯案件", "Job")}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{m.purchased_on}</td>
                <td className="px-4 py-3 text-slate-700">{m.supplier}</td>
                <td className="px-4 py-3 text-slate-700">{m.item}</td>
                <td className="px-4 py-3 text-right">{m.qty}</td>
                <td className="px-4 py-3 text-right">{ntd(m.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium">{ntd(m.qty * m.unit_price)}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{m.jobs?.code ?? "—"}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={async () => {
                      await deleteMaterial(m.id);
                      router.refresh();
                    }}
                    className="text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-300 py-8 text-sm">
                  {t("此區間內無採購紀錄", "No purchases in this range")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={5} className="text-right font-bold px-4 py-3">
                {t(`此區間總計（${startDate} ~ ${endDate}）`, `Total for ${startDate} – ${endDate}`)}
              </td>
              <td className="text-right font-bold px-4 py-3">{ntd(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {showAdd && (
        <AddMaterialModal
          companyId={companyId}
          jobs={jobs}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddMaterialModal({
  companyId,
  jobs,
  onClose,
  onAdded,
}: {
  companyId: string;
  jobs: { id: string; code: string; description: string }[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    purchasedOn: isoDate(new Date()),
    supplier: "",
    item: "",
    qty: "1",
    unitPrice: "",
    jobId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await addMaterial({
      companyId,
      purchasedOn: form.purchasedOn,
      supplier: form.supplier,
      item: form.item,
      qty: Number(form.qty),
      unitPrice: Number(form.unitPrice) || 0,
      jobId: form.jobId || null,
    });
    if (res.error) {
      setError(t("新增失敗，請確認欄位", "Could not add — check the fields"));
      setBusy(false);
      return;
    }
    onAdded();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">{t("新增採購紀錄", "Add Purchase")}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("日期", "Date")}</label>
            <input
              type="date"
              value={form.purchasedOn}
              onChange={(e) => setForm((f) => ({ ...f, purchasedOn: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("供應商", "Supplier")}</label>
            <input
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              placeholder={t("例：永發水電材料行", "e.g. Yongfa Plumbing Supply")}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">{t("項目", "Item")}</label>
            <input
              value={form.item}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("數量", "Qty")}</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500">{t("單價", "Unit Price")}</label>
              <input
                type="number"
                min="0"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="NT$"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">
              {t("關聯案件（選填）", "Linked job (optional)")}
            </label>
            <select
              value={form.jobId}
              onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">{t("不關聯案件", "No linked job")}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.code} — {j.description.slice(0, 24)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
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
            {t("新增", "Add")}
          </button>
        </div>
      </form>
    </div>
  );
}
