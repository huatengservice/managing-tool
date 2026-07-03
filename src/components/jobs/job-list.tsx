"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { StageBadge, UrgencyTag, CategoryBadge } from "@/components/jobs/badges";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { useT } from "@/lib/i18n/provider";
import type { JobCategory, JobStatus, JobUrgency } from "@/lib/types";

export interface JobRow {
  id: string;
  code: string;
  status: JobStatus;
  urgency: JobUrgency;
  category: JobCategory;
  description: string;
  disputed: boolean;
  customers: { name: string; phone: string; address: string } | null;
  schedule_entries: { workers: { name: string } | null }[];
}

export function JobListClient({
  jobs,
  companyId,
  basePath,
  canCreate,
}: {
  jobs: JobRow[];
  companyId: string;
  basePath: string;
  canCreate: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.code.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        (j.customers?.name ?? "").toLowerCase().includes(q) ||
        (j.customers?.address ?? "").toLowerCase().includes(q)
    );
  }, [jobs, query]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("案件列表", "Job List")}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t(`共 ${jobs.length} 筆案件`, `${jobs.length} jobs total`)}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"
          >
            <Plus size={16} />
            {t("建立案件", "Create Job")}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("搜尋客戶姓名、地址、案件編號…", "Search customer, address, job number…")}
          className="flex-1 text-sm outline-none text-slate-700 placeholder:text-slate-400"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
              <th className="text-left font-semibold px-4 py-3">{t("編號", "ID")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("客戶", "Customer")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("類別", "Category")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("狀態", "Status")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("負責師傅", "Worker")}</th>
              <th className="text-left font-semibold px-4 py-3">{t("緊急程度", "Urgency")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => {
              const worker = j.schedule_entries?.find((e) => e.workers)?.workers?.name;
              return (
                <tr key={j.id} className="border-t border-slate-100 hover:bg-amber-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    <Link href={`${basePath}/${j.id}`} className="block">
                      {j.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <Link href={`${basePath}/${j.id}`} className="block">
                      {j.customers?.name}
                      <span className="block text-xs font-normal text-slate-400 line-clamp-1">
                        {j.description}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={j.category} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge status={j.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{worker || t("尚未指派", "Unassigned")}</td>
                  <td className="px-4 py-3">
                    <UrgencyTag urgency={j.urgency} />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-300 py-10 text-sm">
                  {t("沒有符合的案件", "No matching jobs")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateJobModal companyId={companyId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
