/**
 * Live production E2E (anon-key only, no secrets): validates hosted auth
 * config (email confirmations must be OFF), the signup→company→job flow,
 * and tenant isolation. Creates one small test company, prefixed E2E-.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://hbxjetvxeamjdvrbyumr.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhieGpldHZ4ZWFtamR2cmJ5dW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMDk3NDQsImV4cCI6MjA5ODc4NTc0NH0.Oxebj1269SmbCNs4UFcGktYxmzvU3Kh-4RMun0vhQZQ";

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) { console.log("   ", JSON.stringify(detail).slice(0, 300)); fail++; } else pass++;
};

const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const email = `${phone}@managing-tool-five.vercel.app`;
const password = `E2e-${Math.random().toString(36).slice(2)}Xy1`;

const c = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: su, error: suErr } = await c.auth.signUp({ email, password });
check("signup returns a session (email confirmations OFF)", !!su?.session, suErr ?? su);

if (su?.session) {
  const { error: pErr } = await c.from("profiles").insert({ user_id: su.user.id, phone, display_name: "E2E 測試" });
  check("profile insert under RLS", !pErr, pErr);

  const { data: cid, error: cErr } = await c.rpc("create_company", { p_name: "E2E-測試工程行" });
  check("create_company rpc", !!cid, cErr);

  const { data: cust, error: custErr } = await c.from("customers")
    .insert({ company_id: cid, name: "E2E-客戶", phone: "0911000111", address: "測試路1號" }).select().single();
  check("customer insert", !!cust, custErr);

  const { data: job, error: jobErr } = await c.from("jobs")
    .insert({ company_id: cid, customer_id: cust.id, category: "water", description: "E2E 測試案件", created_by: su.user.id, estimated_hours: 2 })
    .select().single();
  check("job insert gets auto number", !!job?.code && job.job_number >= 1001, jobErr ?? job);

  const { error: cancelErr } = await c.from("jobs").update({ status: "cancelled" }).eq("id", job.id);
  check("DB trigger live: cancel without reason rejected", !!cancelErr);

  // isolation: a fresh anonymous client and a fresh second user see nothing
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: anonJobs } = await anon.from("jobs").select("id");
  check("anon sees no jobs", (anonJobs ?? []).length === 0, anonJobs);

  const phone2 = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const c2 = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: su2 } = await c2.auth.signUp({ email: `${phone2}@managing-tool-five.vercel.app`, password });
  const { data: otherJobs } = await c2.from("jobs").select("id");
  const { data: otherCustomers } = await c2.from("customers").select("id");
  check("second user sees zero of company A's data", !!su2?.session && (otherJobs ?? []).length === 0 && (otherCustomers ?? []).length === 0, { otherJobs, otherCustomers });

  // MFA: TOTP enrollment must be enabled on the hosted project
  const { data: factor, error: mfaErr } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "e2e" });
  check("TOTP MFA enrollment enabled", !!factor?.totp?.secret, mfaErr);

  // storage buckets exist and are locked for cross-checks
  const up = await c.storage.from("job-photos").upload(`${cid}/${job.id}/e2e.jpg`, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], { type: "image/jpeg" }));
  check("member can upload to job-photos bucket", !up.error, up.error);
  const cross = await c2.storage.from("job-photos").download(`${cid}/${job.id}/e2e.jpg`);
  check("other tenant cannot download that photo", !!cross.error, cross.data);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
