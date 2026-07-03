"use client";

import Link from "next/link";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { ntd } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export interface InsightJob {
  jobId: string;
  code: string;
  customerName: string;
  description: string;
  revenue: number;
  laborCost: number;
  materialCost: number;
}

export interface WeekPoint {
  week: string;
  revenue: number;
  cost: number;
}

const LOW_MARGIN_THRESHOLD = 40; // % — flag jobs below this

/**
 * Business Insights (spec §6): revenue / labor / material / profit /
 * margin, aggregate and per-job (low-margin jobs surfaced), unpaid-invoice
 * alert, and the revenue-vs-cost trend.
 */
export function InsightsClient({
  jobs,
  weeks,
  unpaidTotal,
}: {
  jobs: InsightJob[];
  weeks: WeekPoint[];
  unpaidTotal: number;
}) {
  const t = useT();
  const revenue = jobs.reduce((s, j) => s + j.revenue, 0);
  const labor = jobs.reduce((s, j) => s + j.laborCost, 0);
  const material = jobs.reduce((s, j) => s + j.materialCost, 0);
  const profit = revenue - labor - material;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">{t("營運分析", "Business Insights")}</h2>
      <p className="text-sm text-slate-500 mb-5">
        {t("營收、成本與獲利概況", "Revenue, cost and profitability at a glance")}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Wallet size={12} />
            {t("總營收", "Revenue")}
          </p>
          <p className="text-xl font-bold text-slate-800">{ntd(revenue)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">{t("人力成本", "Labor Cost")}</p>
          <p className="text-xl font-bold text-slate-800">{ntd(labor)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">{t("材料成本", "Material Cost")}</p>
          <p className="text-xl font-bold text-slate-800">{ntd(material)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
            <TrendingUp size={12} />
            {t(`淨利（毛利率 ${margin}%）`, `Profit (${margin}% margin)`)}
          </p>
          <p className="text-xl font-bold text-emerald-700">{ntd(profit)}</p>
        </div>
      </div>

      {unpaidTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={15} />
          {t(
            `目前有 ${ntd(unpaidTotal)} 已請款但尚未收到款項`,
            `${ntd(unpaidTotal)} has been invoiced but not yet collected`
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">
          {t("每週營收與成本（近 8 週）", "Weekly revenue vs cost (last 8 weeks)")}
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeks}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => ntd(Number(v))} />
            <Legend
              formatter={(value) =>
                value === "revenue" ? t("營收", "Revenue") : t("成本", "Cost")
              }
            />
            <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">
            {t("各案件獲利明細（低毛利案件標紅）", "Per-job profitability (low-margin flagged)")}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left font-semibold px-4 py-3">{t("案件", "Job")}</th>
                <th className="text-right font-semibold px-4 py-3">{t("營收", "Revenue")}</th>
                <th className="text-right font-semibold px-4 py-3">{t("人力", "Labor")}</th>
                <th className="text-right font-semibold px-4 py-3">{t("材料", "Materials")}</th>
                <th className="text-right font-semibold px-4 py-3">{t("淨利", "Profit")}</th>
                <th className="text-right font-semibold px-4 py-3">{t("毛利率", "Margin")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const p = j.revenue - j.laborCost - j.materialCost;
                const m = j.revenue > 0 ? Math.round((p / j.revenue) * 100) : 0;
                const low = m < LOW_MARGIN_THRESHOLD;
                return (
                  <tr key={j.jobId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link href={`/bo/jobs/${j.jobId}`} className="hover:text-amber-600">
                        <span className="font-semibold text-slate-800">{j.customerName}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          {j.code} · {j.description.slice(0, 24)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{ntd(j.revenue)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{ntd(j.laborCost)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{ntd(j.materialCost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{ntd(p)}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        low ? "text-rose-500" : "text-emerald-600"
                      }`}
                    >
                      {m}%{low && <TrendingDown size={11} className="inline ml-1" />}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-300 py-10">
                    {t(
                      "有已簽署報價的案件後，這裡會顯示獲利分析",
                      "Profitability appears here once jobs have signed quotes"
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
