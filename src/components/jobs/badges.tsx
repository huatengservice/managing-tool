"use client";

import { AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n/provider";
import { JOB_STATUS_LABELS, URGENCY_LABELS, CATEGORY_LABELS } from "@/lib/i18n/labels";
import type { JobCategory, JobStatus, JobUrgency } from "@/lib/types";

const STAGE_COLOR: Record<JobStatus, string> = {
  created: "bg-slate-100 text-slate-600 border-slate-200",
  quoted: "bg-sky-50 text-sky-700 border-sky-200",
  accepted: "bg-violet-50 text-violet-700 border-violet-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  work_done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  invoiced: "bg-teal-50 text-teal-700 border-teal-200",
  paid: "bg-slate-800 text-white border-slate-800",
  cancelled: "bg-rose-50 text-rose-500 border-rose-200",
};

export function StageBadge({ status }: { status: JobStatus }) {
  const { lang } = useLang();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STAGE_COLOR[status]}`}
    >
      {JOB_STATUS_LABELS[status][lang]}
    </span>
  );
}

export function UrgencyTag({ urgency }: { urgency: JobUrgency }) {
  const { lang } = useLang();
  if (urgency === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
        <AlertTriangle size={12} />
        {URGENCY_LABELS.urgent[lang]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 text-xs whitespace-nowrap">
      {URGENCY_LABELS.normal[lang]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: JobCategory }) {
  const { lang } = useLang();
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border whitespace-nowrap ${
        category === "water"
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "bg-yellow-50 text-yellow-700 border-yellow-200"
      }`}
    >
      {CATEGORY_LABELS[category][lang]}
    </span>
  );
}
