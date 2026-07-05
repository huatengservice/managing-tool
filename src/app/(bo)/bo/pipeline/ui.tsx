"use client";

import { AlertTriangle } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { JOB_STATUS_LABELS } from "@/lib/i18n/labels";
import type { JobStatus } from "@/lib/types";

export function PipelineHeader() {
  const t = useT();
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold text-slate-800">{t("案件進度總覽", "Job Pipeline")}</h2>
      <p className="text-sm text-slate-500 mt-0.5">
        {t("一眼掌握每個案件目前所在階段", "See where every job stands at a glance")}
      </p>
    </div>
  );
}

export function PipelineColumnTitle({ status, count }: { status: JobStatus; count: number }) {
  const { lang } = useLang();
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-bold text-slate-700">{JOB_STATUS_LABELS[status][lang]}</span>
      <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{count}</span>
    </div>
  );
}

export function NoJobs() {
  const t = useT();
  return (
    <div className="text-xs text-slate-300 border border-dashed border-slate-200 rounded-xl p-4 text-center">
      {t("無案件", "No jobs")}
    </div>
  );
}

export function AssignedTo({ name }: { name: string }) {
  const t = useT();
  return (
    <p className="text-[11px] text-slate-400">
      {t("負責", "Assigned to")}：{name}
    </p>
  );
}

export function DisputedBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-[11px] font-semibold">
      <AlertTriangle size={11} />
      {t("糾紛處理中", "Disputed")}
    </span>
  );
}
