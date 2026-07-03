import type { Metadata } from "next";
import { CheckCircle2, CreditCard, FileText } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import { ntd } from "@/lib/format";
import type { Invoice, QuoteLineItem, Signature } from "@/lib/types";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Public read-only share view (spec §3.6): reached only via an unguessable
 * token link. Shows document data only — never photos, never location or
 * timestamp metadata (spec §5). Business data renders verbatim; static
 * labels are bilingual inline since there's no session language here.
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: share } = await admin
    .from("share_tokens")
    .select("subject_type, subject_id, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!share || new Date(share.expires_at) < new Date()) {
    return (
      <Frame>
        <h1 className="text-base font-bold text-slate-800 mb-2">連結已失效 Link expired</h1>
        <p className="text-sm text-slate-500">此分享連結已過期，請向店家索取新的連結。</p>
      </Frame>
    );
  }

  if (share.subject_type === "quote") {
    const { data: quote } = await admin
      .from("quotes")
      .select("*, quote_line_items(*), jobs(description, code, customers(name)), companies(name)")
      .eq("id", share.subject_id)
      .single();
    if (!quote) return null;
    const { data: signatures } = await admin
      .from("signatures")
      .select("*")
      .eq("quote_id", quote.id)
      .order("signed_at");
    const items = (quote.quote_line_items as QuoteLineItem[]).sort((a, b) => a.position - b.position);
    const total = items.reduce((s, li) => s + li.qty * li.unit_price, 0);
    const job = quote.jobs as unknown as { description: string; code: string; customers: { name: string } };

    return (
      <Frame>
        <DocHeader
          company={(quote.companies as unknown as { name: string }).name}
          title="報價單 Quotation"
          subtitle={`${job.customers.name} — ${job.description}`}
          code={job.code}
        />
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left font-semibold py-2">項目 Item</th>
              <th className="text-right font-semibold py-2 w-14">數量</th>
              <th className="text-right font-semibold py-2 w-24">單價</th>
              <th className="text-right font-semibold py-2 w-24">小計</th>
            </tr>
          </thead>
          <tbody>
            {items.map((li) => (
              <tr key={li.id} className="border-b border-slate-50">
                <td className="py-2">{li.description}</td>
                <td className="py-2 text-right">{li.qty}</td>
                <td className="py-2 text-right">{ntd(li.unit_price)}</td>
                <td className="py-2 text-right font-medium">{ntd(li.qty * li.unit_price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="text-right font-bold pt-3">
                總計 Total
              </td>
              <td className="text-right font-bold pt-3">{ntd(total)}</td>
            </tr>
          </tfoot>
        </table>
        <SignatureLog signatures={(signatures ?? []) as Signature[]} />
      </Frame>
    );
  }

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, jobs(description, code, customers(name)), companies(name, plan_id)")
    .eq("id", share.subject_id)
    .single();
  if (!invoice) return null;
  const inv = invoice as unknown as Invoice & {
    jobs: { description: string; code: string; customers: { name: string } };
    companies: { name: string; plan_id: string };
  };
  const { data: plan } = await admin
    .from("plans")
    .select("features")
    .eq("id", inv.companies.plan_id)
    .single();
  const canPayOnline = inv.status === "unpaid" && !!plan?.features?.online_payment;

  return (
    <Frame>
      <DocHeader
        company={inv.companies.name}
        title={inv.type === "einvoice" ? "電子發票 E-Invoice" : "收據 Receipt"}
        subtitle={`${inv.jobs.customers.name} — ${inv.jobs.description}`}
        code={inv.number}
      />
      {inv.einvoice_number && (
        <p className="text-sm text-slate-600 mb-2">
          發票號碼 Invoice No.：<span className="font-mono">{inv.einvoice_number}</span>
        </p>
      )}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 mb-4">
        <span className="text-sm text-slate-500">應付金額 Amount Due</span>
        <span className="text-2xl font-bold text-slate-900">{ntd(inv.amount)}</span>
      </div>
      {inv.status === "paid" ? (
        <p className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
          <CheckCircle2 size={16} />
          已付款 Paid{inv.paid_at ? `（${new Date(inv.paid_at).toLocaleDateString()}）` : ""}
        </p>
      ) : canPayOnline ? (
        <a
          href={`/pay/${inv.id}`}
          className="w-full bg-slate-900 text-white font-semibold rounded-xl py-3 flex items-center justify-center gap-2 text-sm"
        >
          <CreditCard size={16} />
          線上刷卡付款 Pay by Card
        </a>
      ) : (
        <p className="text-xs text-slate-400">
          請以現金或轉帳方式付款，完成後由店家確認。 Pay by cash or bank transfer; the
          business will confirm receipt.
        </p>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {children}
        <p className="text-[10px] text-slate-300 mt-6 text-center">
          此為唯讀分享頁面 · Read-only shared document
        </p>
      </div>
    </div>
  );
}

function DocHeader({
  company,
  title,
  subtitle,
  code,
}: {
  company: string;
  title: string;
  subtitle: string;
  code: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 text-slate-800 font-bold">
        <FileText size={18} className="text-amber-500" />
        {company}
      </div>
      <h1 className="text-lg font-bold text-slate-900 mt-2">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <p className="text-xs font-mono text-slate-300 mt-1">{code}</p>
    </div>
  );
}

function SignatureLog({ signatures }: { signatures: Signature[] }) {
  if (signatures.length === 0) return null;
  const partyLabel = { bo: "老闆 Owner", worker: "師傅 Worker", customer: "客戶 Customer" };
  const mechLabel = {
    device_handoff: "裝置代簽 device handoff",
    remote_account: "帳戶簽署 account",
  };
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-xs">
      <p className="text-slate-500 mb-2 font-semibold">雙方簽署紀錄 Signature Log</p>
      {signatures.map((s) => (
        <p key={s.id} className="flex items-center gap-1.5 text-emerald-600 py-0.5">
          <CheckCircle2 size={12} />
          {partyLabel[s.party]}（{mechLabel[s.mechanism]}，{new Date(s.signed_at).toLocaleString()}）
        </p>
      ))}
    </div>
  );
}
