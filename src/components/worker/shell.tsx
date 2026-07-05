"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { LanguageToggle, useT } from "@/lib/i18n/provider";

export function WorkerShell({
  companyName,
  displayName,
  children,
}: {
  companyName: string;
  displayName: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-bold text-slate-800">{companyName}</p>
          <p className="text-xs text-slate-400">
            {displayName} · {t("師傅", "Worker")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <button
            onClick={() => signOut()}
            className="text-slate-400 hover:text-slate-600"
            title={t("登出", "Log out")}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
