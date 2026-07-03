import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptForm } from "./invite-form";

/**
 * Worker invite landing (spec §8): reached only via the unique single-use
 * link the BO sent personally. Never linked from anywhere public — a worker
 * lands here directly and never needs the generic login screen.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("peek_worker_invite", { p_token: token });
  const invite = Array.isArray(data) && data.length > 0 ? data[0] : null;

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h1 className="text-base font-bold text-slate-800 mb-2">邀請連結無效</h1>
          <p className="text-sm text-slate-500">
            此邀請連結已使用、已過期或已被撤銷。請聯絡您的老闆重新產生邀請連結。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Users className="text-amber-400" size={24} />
          </div>
          <h1 className="text-lg font-bold text-slate-800">您受邀加入</h1>
          <p className="text-sm font-semibold text-amber-600 mt-1">{invite.company_name}</p>
          <p className="text-xs text-slate-400 mt-1">邀請連結來自老闆的團隊管理頁面</p>
        </div>
        <InviteAcceptForm
          token={token}
          workerName={invite.worker_name}
          workerPhone={invite.worker_phone}
        />
      </div>
    </div>
  );
}
