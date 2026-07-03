import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">
          ← 返回首頁
        </Link>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            本文件為依業界常見範本草擬之暫行版本（版本 2026-07-03-draft），正式生效前仍須經
            熟悉台灣個人資料保護法之律師審閱定稿。同意紀錄機制已上線；文字內容屬暫行性質。
          </span>
        </div>
        <article className="prose-sm mt-6 bg-white border border-slate-200 rounded-2xl p-8 text-slate-700 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:text-slate-800 [&_p]:mt-2 [&_p]:text-sm [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-sm [&_li]:mt-1">
          {children}
        </article>
      </div>
    </div>
  );
}
