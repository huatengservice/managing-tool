/**
 * RLS isolation test (PRODUCT_SPEC §15.1): two fake companies, real
 * clients, asserting cross-tenant queries return nothing and role
 * boundaries hold at the database. Run with a local `supabase start`:
 *
 *   npm run test:rls
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";

process.loadEnvFile(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail ?? "");
  }
}

async function makeUser(tag: string): Promise<{ client: SupabaseClient; id: string }> {
  const email = `${tag}-${Date.now()}@phone.huateng.local`;
  const password = "test-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${tag}: ${signInError.message}`);
  return { client, id: data.user.id };
}

async function main() {
  console.log("— setting up two fake companies —");
  const boA = await makeUser("bo-a");
  const boB = await makeUser("bo-b");

  for (const [bo, tag] of [
    [boA, "A"],
    [boB, "B"],
  ] as const) {
    await bo.client.from("profiles").insert({
      user_id: bo.id,
      phone: `09${Math.floor(Math.random() * 1e8)}`,
      display_name: `BO ${tag}`,
    });
  }

  const { data: companyA, error: caErr } = await boA.client.rpc("create_company", {
    p_name: "公司A 水電行",
  });
  const { data: companyB } = await boB.client.rpc("create_company", { p_name: "公司B 工程行" });
  check("both companies created via rpc", !!companyA && !!companyB, caErr);

  // Seed tenant data in each company as its own BO.
  async function seed(client: SupabaseClient, companyId: string, tag: string) {
    const { data: customer } = await client
      .from("customers")
      .insert({ company_id: companyId, name: `客戶${tag}`, phone: `0911${tag === "A" ? "111111" : "222222"}`, address: `${tag}市` })
      .select()
      .single();
    const { data: job } = await client
      .from("jobs")
      .insert({
        company_id: companyId,
        customer_id: customer!.id,
        category: "water",
        description: `${tag} 漏水維修`,
        created_by: (await client.auth.getUser()).data.user!.id,
        estimated_hours: 2,
      })
      .select()
      .single();
    const { data: worker } = await client
      .from("workers")
      .insert({ company_id: companyId, name: `師傅${tag}`, phone: `0922${tag === "A" ? "111111" : "222222"}` })
      .select()
      .single();
    await client.from("worker_rates").insert({
      worker_id: worker!.id,
      company_id: companyId,
      rate_type: "hourly",
      rate: 350,
    });
    await client.from("bo_customer_notes").upsert({
      customer_id: customer!.id,
      company_id: companyId,
      tags: [`${tag}-付款慢`],
    });
    await client.from("bo_worker_notes").upsert({
      worker_id: worker!.id,
      company_id: companyId,
      tags: [`${tag}-可靠`],
      log: `${tag} secret log`,
    });
    await client.from("materials").insert({
      company_id: companyId,
      purchased_on: "2026-07-01",
      supplier: `${tag} 材料行`,
      item: "PVC 管",
      qty: 10,
      unit_price: 85,
      created_by: (await client.auth.getUser()).data.user!.id,
    });
    return { customer: customer!, job: job!, worker: worker! };
  }

  const a = await seed(boA.client, companyA as string, "A");
  const b = await seed(boB.client, companyB as string, "B");

  console.log("— cross-tenant isolation (the catastrophic failure mode) —");
  for (const table of [
    "customers",
    "jobs",
    "workers",
    "worker_rates",
    "materials",
    "bo_customer_notes",
    "bo_worker_notes",
    "quotes",
    "invoices",
    "schedule_entries",
  ]) {
    const { data } = await boA.client.from(table).select("*").eq("company_id", companyB);
    check(`A sees zero rows of B's ${table}`, (data ?? []).length === 0, data);
  }
  const { data: bJobDirect } = await boA.client.from("jobs").select("*").eq("id", b.job.id);
  check("A cannot fetch B's job by id", (bJobDirect ?? []).length === 0);
  const { data: crossUpdate } = await boA.client
    .from("customers")
    .update({ name: "hacked" })
    .eq("id", b.customer.id)
    .select();
  check("A cannot update B's customer", (crossUpdate ?? []).length === 0);

  console.log("— worker role boundaries —");
  // Invite a worker into company A through the real token flow.
  const token = randomBytes(32).toString("base64url");
  await boA.client
    .from("workers")
    .update({
      invite_token_hash: createHash("sha256").update(token).digest("hex"),
      invite_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    .eq("id", a.worker.id);
  const workerUser = await makeUser("worker-a");
  await workerUser.client.from("profiles").insert({
    user_id: workerUser.id,
    phone: `0933${Math.floor(Math.random() * 1e6)}`,
    display_name: "師傅A本人",
  });
  const { data: acceptedCompany, error: acceptErr } = await workerUser.client.rpc(
    "accept_worker_invite",
    { p_token: token }
  );
  check("worker invite acceptance works", acceptedCompany === companyA, acceptErr);
  const { error: reuseErr } = await workerUser.client.rpc("accept_worker_invite", {
    p_token: token,
  });
  check("invite token is single-use", !!reuseErr);

  const { data: ratesSeen } = await workerUser.client.from("worker_rates").select("*");
  check("worker can NEVER see pay rates", (ratesSeen ?? []).length === 0, ratesSeen);
  const { data: boNotesSeen } = await workerUser.client.from("bo_worker_notes").select("*");
  check("worker can NEVER see BO's notes about workers", (boNotesSeen ?? []).length === 0);
  const { data: custNotesSeen } = await workerUser.client.from("bo_customer_notes").select("*");
  check("worker can NEVER see BO's notes about customers", (custNotesSeen ?? []).length === 0);
  const { data: materialsSeen } = await workerUser.client.from("materials").select("*");
  check("worker cannot see the materials log", (materialsSeen ?? []).length === 0);
  const { data: unassignedJobs } = await workerUser.client.from("jobs").select("*");
  check("worker sees no jobs they aren't assigned to/didn't create", (unassignedJobs ?? []).length === 0);

  // Assign the worker to job A via schedule, then re-check visibility.
  await boA.client.from("schedule_entries").insert({
    company_id: companyA,
    job_id: a.job.id,
    worker_id: a.worker.id,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 2 * 3600_000).toISOString(),
    created_by: boA.id,
  });
  const { data: assignedJobs } = await workerUser.client.from("jobs").select("*");
  check("worker sees their assigned job", (assignedJobs ?? []).length === 1);

  // §15.10: a worker's invoice attempt must be rejected server-side.
  const { data: invoiceAttempt } = await workerUser.client
    .from("invoices")
    .insert({
      company_id: companyA,
      job_id: a.job.id,
      type: "receipt",
      number: "INV-HACK",
      amount: 100,
      issued_by: workerUser.id,
    })
    .select();
  check("worker cannot issue an invoice (API-level)", !invoiceAttempt || invoiceAttempt.length === 0);
  const { error: statusHack } = await workerUser.client
    .from("jobs")
    .update({ status: "paid" })
    .eq("id", a.job.id);
  const { data: jobAfterHack } = await boA.client.from("jobs").select("status").eq("id", a.job.id).single();
  check(
    "worker cannot force a job to paid",
    jobAfterHack?.status !== "paid",
    statusHack ?? jobAfterHack
  );

  console.log("— append-only signature log (§15.3) —");
  const { data: quote } = await boA.client
    .from("quotes")
    .insert({ company_id: companyA, job_id: a.job.id, created_by: boA.id })
    .select()
    .single();
  await boA.client.from("quote_line_items").insert({
    quote_id: quote!.id,
    company_id: companyA,
    description: "工資",
    qty: 1,
    unit_price: 1000,
  });
  const { data: sig, error: sigErr } = await boA.client
    .from("signatures")
    .insert({
      company_id: companyA,
      job_id: a.job.id,
      quote_id: quote!.id,
      subject_type: "quote",
      party: "bo",
      mechanism: "remote_account",
      signer_user_id: boA.id,
    })
    .select()
    .single();
  check("signature insert works", !!sig, sigErr);
  const { error: sigUpdateErr } = await boA.client
    .from("signatures")
    .update({ party: "customer" })
    .eq("id", sig!.id);
  const { error: sigDeleteErr } = await boA.client.from("signatures").delete().eq("id", sig!.id);
  const { data: sigStill } = await boA.client.from("signatures").select("id").eq("id", sig!.id);
  check("signature UPDATE blocked (even for BO)", (sigStill ?? []).length === 1 && sigUpdateErr !== undefined);
  check("signature DELETE blocked (even for BO)", (sigStill ?? []).length === 1 && sigDeleteErr !== undefined);
  // Service role must be blocked too (trigger, not just grants).
  const { error: adminSigDelete } = await admin.from("signatures").delete().eq("id", sig!.id);
  check("signature DELETE blocked even for service role", !!adminSigDelete);

  console.log("— quote immutability after signing (§15.10) —");
  await boA.client.from("quotes").update({ status: "bo_signed" }).eq("id", quote!.id);
  const { error: itemEditErr } = await boA.client
    .from("quote_line_items")
    .update({ unit_price: 999999 })
    .eq("quote_id", quote!.id);
  const { data: itemAfter } = await boA.client
    .from("quote_line_items")
    .select("unit_price")
    .eq("quote_id", quote!.id)
    .single();
  check(
    "signed quote line items cannot be edited",
    Number(itemAfter?.unit_price) === 1000,
    itemEditErr ?? itemAfter
  );

  console.log("— completion requires an after-photo (§5) —");
  const { error: noPhotoErr } = await boA.client
    .from("jobs")
    .update({ status: "work_done" })
    .eq("id", a.job.id);
  const { data: jobNoPhoto } = await boA.client.from("jobs").select("status").eq("id", a.job.id).single();
  check("work_done blocked without after-photo", jobNoPhoto?.status !== "work_done", noPhotoErr);

  console.log("— cancellation requires a reason (§4) —");
  const { error: cancelErr } = await boA.client
    .from("jobs")
    .update({ status: "cancelled" })
    .eq("id", a.job.id);
  check("cancel without reason rejected", !!cancelErr);

  console.log("— customer private notes (§2, layer 3) —");
  const customerUser = await makeUser("customer-a");
  await admin.from("customer_accounts").insert({
    company_id: companyA,
    customer_id: a.customer.id,
    user_id: customerUser.id,
  });
  const { data: custJobs } = await customerUser.client.from("jobs").select("*");
  check("customer sees own job history", (custJobs ?? []).length === 1);
  const { data: note } = await customerUser.client
    .from("customer_private_notes")
    .insert({ user_id: customerUser.id, job_id: a.job.id, note: "customer secret" })
    .select()
    .single();
  check("customer can write their private note", !!note);
  const { data: boSeesNotes } = await boA.client.from("customer_private_notes").select("*");
  check("BO can NEVER see customer private notes", (boSeesNotes ?? []).length === 0, boSeesNotes);
  const { data: workerSeesNotes } = await workerUser.client.from("customer_private_notes").select("*");
  check("worker can NEVER see customer private notes", (workerSeesNotes ?? []).length === 0);
  const { data: custRates } = await customerUser.client.from("worker_rates").select("*");
  const { data: custMaterials } = await customerUser.client.from("materials").select("*");
  check("customer sees no rates/materials", (custRates ?? []).length === 0 && (custMaterials ?? []).length === 0);
  const { data: custSeesBoNotes } = await customerUser.client.from("bo_customer_notes").select("*");
  check("customer can NEVER see BO's notes about them", (custSeesBoNotes ?? []).length === 0);

  console.log("— anonymous access —");
  const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: anonJobs } = await anonClient.from("jobs").select("*");
  const { data: anonCustomers } = await anonClient.from("customers").select("*");
  const { data: anonPlans } = await anonClient.from("plans").select("*");
  check("anon sees nothing tenant-scoped", (anonJobs ?? []).length === 0 && (anonCustomers ?? []).length === 0);
  check("anon can read public plan pricing", (anonPlans ?? []).length === 3, anonPlans?.length);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
