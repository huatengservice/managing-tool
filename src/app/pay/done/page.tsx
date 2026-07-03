import { CheckCircle2, XCircle } from "lucide-react";

export default async function PayDonePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const success = ok === "1";
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 text-center">
        {success ? (
          <>
            <CheckCircle2 className="text-emerald-500 mx-auto mb-3" size={40} />
            <h1 className="text-base font-bold text-slate-800 mb-1">付款完成</h1>
            <p className="text-sm text-slate-500">
              感謝您的付款。店家收到金流確認後，紀錄會自動更新為已付款。
            </p>
          </>
        ) : (
          <>
            <XCircle className="text-rose-500 mx-auto mb-3" size={40} />
            <h1 className="text-base font-bold text-slate-800 mb-1">付款未完成</h1>
            <p className="text-sm text-slate-500">付款未成功或已取消，您可以重新開啟付款連結再試一次。</p>
          </>
        )}
      </div>
    </div>
  );
}
