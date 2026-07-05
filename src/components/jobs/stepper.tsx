"use client";

import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { JOB_STATUS_LABELS } from "@/lib/i18n/labels";
import { JOB_PIPELINE, type JobStatus } from "@/lib/types";

export function Stepper({ status }: { status: JobStatus }) {
  const { lang } = useLang();
  const t = useT();

  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-rose-500 text-sm font-semibold">
        <XCircle size={18} />
        {JOB_STATUS_LABELS.cancelled[lang]}
      </div>
    );
  }

  const stage = JOB_PIPELINE.indexOf(status);
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max">
        {JOB_PIPELINE.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-2 w-24">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : active
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "bg-white border-slate-200 text-slate-300"
                  }`}
                >
                  {done ? <CheckCircle2 size={20} /> : active ? <Clock size={18} /> : <Circle size={16} />}
                </div>
                <span
                  className={`text-xs font-semibold text-center ${
                    done || active ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  {JOB_STATUS_LABELS[s][lang]}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    done
                      ? "bg-emerald-50 text-emerald-600"
                      : active
                        ? "bg-amber-50 text-amber-600"
                        : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {done ? t("完成", "Done") : active ? t("進行中", "In progress") : t("尚未開始", "Not started")}
                </span>
              </div>
              {i < JOB_PIPELINE.length - 1 && (
                <div className={`h-0.5 w-8 ${i < stage ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
