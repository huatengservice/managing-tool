"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase, Calendar, CreditCard, LayoutGrid, LogOut, Package,
  TrendingUp, UserCircle, Users,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { LanguageToggle, useT } from "@/lib/i18n/provider";
import type { PlanId } from "@/lib/types";

export function BoShell({
  companyName,
  planId,
  children,
}: {
  companyName: string;
  planId: PlanId;
  children: React.ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();

  const nav = [
    { href: "/bo/pipeline", label: t("案件進度", "Pipeline"), icon: LayoutGrid },
    { href: "/bo/schedule", label: t("排程", "Schedule"), icon: Calendar },
    { href: "/bo/jobs", label: t("案件列表", "Jobs"), icon: Briefcase },
    { href: "/bo/customers", label: t("客戶", "Customers"), icon: UserCircle },
    { href: "/bo/team", label: t("團隊管理", "Team"), icon: Users },
    { href: "/bo/materials", label: t("材料採購", "Materials"), icon: Package },
    { href: "/bo/insights", label: t("營運分析", "Insights"), icon: TrendingUp },
    { href: "/bo/billing", label: t("方案與帳單", "Plan & Billing"), icon: CreditCard },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r border-slate-200 p-4 flex flex-col shrink-0">
        <div className="px-2 mb-6">
          <div className="font-bold text-slate-800 truncate">{companyName}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {planId === "starter" ? t("入門版", "Starter") : planId === "growth" ? t("成長版", "Growth") : t("專業版", "Pro")}
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold ${
                pathname.startsWith(href)
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <LanguageToggle />
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={15} />
            {t("登出", "Log out")}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 min-w-0">{children}</main>
    </div>
  );
}
