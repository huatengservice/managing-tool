/**
 * Live TapPay sandbox test against production: creates a throwaway
 * company + invoice, then charges it through /api/pay with TapPay's
 * static sandbox test prime. Also probes whether a BO can self-upgrade
 * their plan via the API (security check).
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://hbxjetvxeamjdvrbyumr.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieGpldHZ4ZWFtamR2cmJ5dW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDk3NDQsImV4cCI6MjA5ODc4NTc0NH0.Oxebj1269SmbCNs4UFcGktYxmzvU3Kh-4RMun0vhQZQ";
const APP = "https://managing-tool-five.vercel.app";
// TapPay's documented static test prime for sandbox server-side testing.
const TEST_PRIME = "test_3a2fb2b7e892b914a03c95dd4dd5dc7970c908df67a49527c0a648b2bc9";

const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const c = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: su, error: suErr } = await c.auth.signUp({
  email: `${phone}@managing-tool-five.vercel.app`,
  password: `E2e-${Math.random().toString(36).slice(2)}Xy1`,
});
if (!su?.session) { console.error("signup failed", suErr); process.exit(1); }

await c.from("profiles").insert({ user_id: su.user.id, phone, display_name: "E2E-Pay" });
const { data: cid } = await c.rpc("create_company", { p_name: "E2E-付款測試行" });
const { data: cust } = await c.from("customers")
  .insert({ company_id: cid, name: "E2E-付款客戶", phone: "0911333444", address: "測試路" }).select().single();
const { data: job } = await c.from("jobs")
  .insert({ company_id: cid, customer_id: cust.id, category: "water", description: "E2E 付款測試", created_by: su.user.id })
  .select().single();
const { data: invoice } = await c.from("invoices")
  .insert({ company_id: cid, job_id: job.id, type: "receipt", number: "R-E2E-TEST", amount: 100, issued_by: su.user.id })
  .select().single();
console.log("test invoice created:", invoice.id, "NT$", invoice.amount);

// SECURITY PROBE: can a BO self-upgrade to a paid plan via the API?
const { error: upErr } = await c.from("companies").update({ plan_id: "growth" }).eq("id", cid);
const { data: after } = await c.from("companies").select("plan_id").eq("id", cid).single();
console.log(`self-upgrade probe: plan_id is now '${after.plan_id}'`,
  after.plan_id === "growth" ? "⚠️ HOLE: BO can self-upgrade without paying" : "✓ blocked", upErr?.message ?? "");

// Pay page should render TapPay card fields (env configured)
const pageRes = await fetch(`${APP}/pay/${invoice.id}`);
const html = await pageRes.text();
console.log("pay page:", pageRes.status,
  html.includes("tp-card-number") ? "✓ card form rendered" :
  html.includes("金流尚未設定") ? "✗ TAPPAY_* env missing" :
  html.includes("未開通線上付款") ? "(plan gate active)" : "(unexpected content)");

// Charge with the static sandbox prime
const payRes = await fetch(`${APP}/api/pay`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ invoiceId: invoice.id, prime: TEST_PRIME }),
});
console.log("charge:", payRes.status, await payRes.text());

// Confirm invoice state + read TapPay's raw response via billing_events (BO-readable)
const { data: invAfter } = await c.from("invoices").select("status, payment_method, paid_at").eq("id", invoice.id).single();
console.log("invoice after:", invAfter);
const { data: events } = await c.from("billing_events").select("kind, payload").eq("company_id", cid).order("created_at", { ascending: false }).limit(1);
if (events?.[0]) console.log("tappay says:", events[0].kind, "| msg:", events[0].payload?.msg ?? JSON.stringify(events[0].payload).slice(0, 200));

// cron endpoint must reject unauthenticated calls
const cron = await fetch(`${APP}/api/cron/billing`);
console.log("cron unauthenticated:", cron.status, cron.status === 401 ? "✓ rejected" : "✗ should be 401");
