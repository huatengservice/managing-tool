import { CreditCard } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTapPayConfigured } from "@/lib/tappay/server";
import { ntd } from "@/lib/format";
import { PayClient } from "./pay-client";

/**
 * Card payment page for an invoice (spec §3.6). Reached from the share
 * link or the customer portal; the invoice id is an unguessable UUID and
 * this page exposes only amount + payee. The charge itself happens
 * server-to-server in /api/pay with the secret partner key.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const admin = createAdminClient();
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, jobs(description), companies(name, plan_id)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice || invoice.status !== "unpaid") {
    return (
      <Shell>
        <h1 className="text-base font-bold text-slate-800 mb-2">無法付款</h1>
        <p className="text-sm text-slate-500">此帳單不存在或已完成付款。</p>
      </Shell>
    );
  }

  const { data: plan } = await admin
    .from("plans")
    .select("features")
    .eq("id", (invoice.companies as unknown as { plan_id: string }).plan_id)
    .single();
  if (!plan?.features?.online_payment) {
    return (
      <Shell>
        <h1 className="text-base font-bold text-slate-800 mb-2">未開通線上付款</h1>
        <p className="text-sm text-slate-500">此店家尚未開通線上刷卡，請以現金或轉帳付款。</p>
      </Shell>
    );
  }

  if (!isTapPayConfigured()) {
    return (
      <Shell>
        <h1 className="text-base font-bold text-slate-800 mb-2">金流尚未設定</h1>
        <p className="text-sm text-slate-500">
          尚未設定 TapPay 金流金鑰（TAPPAY_*），暫時無法線上付款。
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <CreditCard className="text-amber-400" size={22} />
        </div>
        <h1 className="text-base font-bold text-slate-800">
          {(invoice.companies as unknown as { name: string }).name}
        </h1>
        <p className="text-2xl font-bold text-slate-900 mt-2">{ntd(invoice.amount)}</p>
        <p className="text-xs text-slate-400 mt-1">{invoice.number}</p>
      </div>
      <PayClient invoiceId={invoice.id} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">{children}</div>
    </div>
  );
}
