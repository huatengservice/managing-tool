"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateJobModal } from "@/components/jobs/create-job-modal";
import { useT } from "@/lib/i18n/provider";

export function WorkerJobsEmpty() {
  const t = useT();
  return (
    <div className="text-center text-slate-300 border border-dashed border-slate-200 rounded-xl py-14 text-sm">
      <Plus className="mx-auto mb-2" size={20} />
      {t("尚無指派給您的案件", "No jobs assigned to you yet")}
    </div>
  );
}

export function WorkerJobsHeader({ count, companyId }: { count: number; companyId: string }) {
  const t = useT();
  const [showCreate, setShowCreate] = useState(false);
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">{t("我的案件", "My Jobs")}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{t(`共 ${count} 件`, `${count} jobs`)}</p>
      </div>
      {/* Workers can create job records too (spec §2) */}
      <button
        onClick={() => setShowCreate(true)}
        className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800"
      >
        <Plus size={16} />
        {t("建立案件", "Create Job")}
      </button>
      {showCreate && <CreateJobModal companyId={companyId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
