import Link from "next/link";
import { Briefcase, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").order("sort");
  const plans = (data ?? []) as Plan[];

  const featureLines = (p: Plan) => {
    const lines = ["案件紀錄與進度看板", "排程（師傅＋車輛）", "報價與完工雙方簽署", "材料採購紀錄"];
    if (p.features.einvoice) lines.push("電子發票（統一發票）");
    if (p.features.online_payment) lines.push("線上刷卡收款");
    if (p.features.cross_worker_dashboard) lines.push("跨師傅營運分析");
    if (p.features.priority_support) lines.push("優先客服支援");
    lines.push(
      p.features.max_workers === null ? "師傅人數不限" : `最多 ${p.features.max_workers} 位師傅`
    );
    return lines;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <Briefcase className="text-amber-400" size={16} />
          </div>
          工程行工作管理
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            登入
          </Link>
          {/* Public, discoverable company signup — clearly separate from Log In (spec §8) */}
          <Link
            href="/auth/signup"
            className="text-sm font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800"
          >
            建立公司帳號
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        <section className="text-center py-16">
          <h1 className="text-3xl font-bold text-slate-900 leading-snug">
            水電工程行的
            <br />
            案件、報價、排程與請款，一套搞定
          </h1>
          <p className="text-slate-500 mt-4 max-w-xl mx-auto">
            專為小型工程行設計：施工前後照片留存、雙方簽署紀錄、師傅與車輛排班、
            材料對帳與營運分析。手機就能用，不用裝 App。
          </p>
          <Link
            href="/auth/signup"
            className="inline-block mt-8 bg-amber-500 text-slate-900 font-bold px-8 py-3.5 rounded-2xl hover:bg-amber-400"
          >
            免費開始使用
          </Link>
        </section>

        <section className="pb-20">
          <h2 className="text-center text-xl font-bold text-slate-800 mb-8">方案與價格</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`bg-white border rounded-2xl p-6 flex flex-col ${
                  p.id === "growth" ? "border-amber-400 shadow-md" : "border-slate-200"
                }`}
              >
                <h3 className="font-bold text-slate-800">{p.name_zh}</h3>
                <p className="mt-2">
                  <span className="text-2xl font-bold text-slate-900">
                    NT${p.price_monthly.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-400"> /月</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                  {featureLines(p).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  className={`mt-6 text-center text-sm font-semibold rounded-xl py-2.5 ${
                    p.id === "growth"
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p.price_monthly === 0 ? "免費開始" : "開始使用"}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">
            付費方案於建立帳號後，可在「方案與帳單」頁面升級並以信用卡定期扣款。
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 space-x-4">
        <Link href="/legal/terms" className="hover:text-slate-600">服務條款</Link>
        <Link href="/legal/privacy" className="hover:text-slate-600">隱私權政策</Link>
        <Link href="/legal/dpa" className="hover:text-slate-600">資料處理協議</Link>
      </footer>
    </div>
  );
}
