import { randomBytes } from "crypto";
import { CreditCard } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoicePaymentForm } from "@/lib/newebpay/mpg";
import { GatewayRedirectForm } from "@/components/gateway-redirect-form";
import { ntd } from "@/lib/format";

/**
 * Card payment hand-off for an invoice (spec §3.6). Reached from the share
 * link or the customer portal; the invoice id is an unguessable UUID and
 * this page exposes only amount + payee. Payment truth comes from the
 * signature-verified webhook, never from this page or the return redirect.
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

  // One fresh order number per attempt; the webhook reconciles by it.
  const orderNo = `PAY${Date.now()}${randomBytes(2).toString("hex").toUpperCase()}`;
  const form = buildInvoicePaymentForm({
    merchantOrderNo: orderNo,
    amount: invoice.amount,
    itemDesc: (invoice.jobs as unknown as { description: string }).description,
  });

  if (!form) {
    return (
      <Shell>
        <h1 className="text-base font-bold text-slate-800 mb-2">金流尚未設定</h1>
        <p className="text-sm text-slate-500">
          尚未設定 NewebPay 金流金鑰（NEWEBPAY_*），暫時無法線上付款。
        </p>
      </Shell>
    );
  }

  await admin.from("payments").insert({
    company_id: invoice.company_id,
    invoice_id: invoice.id,
    amount: invoice.amount,
    method: "card",
    status: "pending",
    provider: "newebpay",
    provider_trade_no: orderNo,
  });

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
      <GatewayRedirectForm
        action={form.action}
        fields={form.fields}
        label="前往藍新金流安全付款頁面"
      />
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
