import type { JobCategory, JobStatus, JobUrgency, Lang } from "./shared-types";

export const JOB_STATUS_LABELS: Record<JobStatus, { zh: string; en: string }> = {
  created: { zh: "已建立", en: "Created" },
  quoted: { zh: "已報價", en: "Quoted" },
  accepted: { zh: "已確認", en: "Accepted" },
  in_progress: { zh: "進行中", en: "In Progress" },
  work_done: { zh: "已完工", en: "Work Done" },
  invoiced: { zh: "已請款", en: "Invoiced" },
  paid: { zh: "已付款", en: "Paid" },
  cancelled: { zh: "已取消", en: "Cancelled" },
};

export const CATEGORY_LABELS: Record<JobCategory, { zh: string; en: string }> = {
  water: { zh: "水", en: "Water" },
  electric: { zh: "電", en: "Electrical" },
};

export const URGENCY_LABELS: Record<JobUrgency, { zh: string; en: string }> = {
  normal: { zh: "一般", en: "Normal" },
  urgent: { zh: "緊急", en: "Urgent" },
};

export function label<K extends string>(
  map: Record<K, { zh: string; en: string }>,
  key: K,
  lang: Lang
): string {
  return map[key][lang];
}
