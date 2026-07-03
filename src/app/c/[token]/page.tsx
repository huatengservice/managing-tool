import { QrCode } from "lucide-react";
import { peekCustomerSignupToken } from "@/lib/actions/customer-auth";
import { CustomerSignupForm } from "./signup-form";

/**
 * Customer QR opt-in landing (spec §9): reached by scanning the QR on the
 * BO/Worker device with a native phone camera — it's just a URL, tied to
 * one customer record, single-use and time-limited.
 */
export default async function CustomerSignupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await peekCustomerSignupToken(token);

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h1 className="text-base font-bold text-slate-800 mb-2">連結已失效</h1>
          <p className="text-sm text-slate-500">
            此註冊連結已使用或已過期，請請師傅重新出示 QR code。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <QrCode className="text-amber-400" size={26} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">建立您的帳戶</h1>
          <p className="text-sm text-slate-500 mt-1">
            與 <span className="font-semibold text-amber-600">{info.companyName}</span>{" "}
            的完整服務紀錄將顯示於您的帳戶
          </p>
        </div>
        <CustomerSignupForm token={token} phone={info.customerPhone} />
      </div>
    </div>
  );
}
