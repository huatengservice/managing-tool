"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import { isValidPhone, normalizePhone, phoneToEmail } from "@/lib/auth/phone";
import type { ActionResult } from "@/app/auth/actions";

export interface QrTokenInfo {
  customerId: string;
  companyId: string;
  customerName: string;
  customerPhone: string;
  companyName: string;
}

/** Validate a QR signup token (unused, unexpired) and describe its customer. */
export async function peekCustomerSignupToken(token: string): Promise<QrTokenInfo | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_signup_tokens")
    .select("customer_id, company_id, expires_at, used_at, customers(name, phone), companies(name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at) < new Date()) return null;
  const customer = data.customers as unknown as { name: string; phone: string };
  const company = data.companies as unknown as { name: string };
  return {
    customerId: data.customer_id,
    companyId: data.company_id,
    customerName: customer.name,
    customerPhone: customer.phone,
    companyName: company.name,
  };
}

/**
 * Customer opt-in signup (spec §9): phone pre-filled from the customer
 * record, password set here (OAuth variants land in
 * finalizeCustomerAccount after the callback). Single-use token.
 */
export async function signUpCustomerWithPassword(input: {
  token: string;
  password: string;
}): Promise<ActionResult> {
  if (input.password.length < 8) return { error: "weak_password" };
  const info = await peekCustomerSignupToken(input.token);
  if (!info) return { error: "token_invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(info.customerPhone),
    password: input.password,
    options: { data: { phone: normalizePhone(info.customerPhone), display_name: info.customerName } },
  });
  if (error || !data.user) {
    return { error: error?.code === "user_already_exists" ? "phone_taken" : "signup_failed" };
  }

  await supabase.from("profiles").insert({
    user_id: data.user.id,
    phone: normalizePhone(info.customerPhone),
    display_name: info.customerName,
  });

  return finalizeCustomerAccount(input.token);
}

/** Link the signed-in auth user to the customer record; consumes the token. */
export async function finalizeCustomerAccount(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const admin = createAdminClient();
  // Atomic single-use claim: only the first request flips used_at.
  const { data: claimed } = await admin
    .from("customer_signup_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("customer_id, company_id")
    .maybeSingle();
  if (!claimed) return { error: "token_invalid" };

  const { error } = await admin.from("customer_accounts").insert({
    company_id: claimed.company_id,
    customer_id: claimed.customer_id,
    user_id: user.id,
  });
  if (error && error.code !== "23505") return { error: "account_failed" };

  // Ensure a profile exists even for OAuth signups that skipped the form.
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) {
    const { data: customer } = await admin
      .from("customers")
      .select("name, phone")
      .eq("id", claimed.customer_id)
      .single();
    await admin.from("profiles").insert({
      user_id: user.id,
      phone: normalizePhone(customer?.phone ?? ""),
      display_name: customer?.name ?? "",
    });
  }
  return { ok: true };
}

/** Customer's own private note on a job — never visible to BO/Worker (spec §2). */
export async function saveCustomerPrivateNote(input: {
  jobId: string;
  note: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase
    .from("customer_private_notes")
    .upsert(
      {
        user_id: user.id,
        job_id: input.jobId,
        note: input.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,job_id" }
    );
  if (error) return { error: "save_failed" };
  return { ok: true };
}

/** Remote quote signing from the customer's own account (spec §3.2). */
export async function customerSignQuoteRemotely(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // RLS-scoped read: only this customer's own quote is visible.
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, job_id, company_id, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "not_found" };
  if (quote.status !== "bo_signed") return { error: "not_signable" };

  const { error: sigError } = await supabase.from("signatures").insert({
    company_id: quote.company_id,
    job_id: quote.job_id,
    quote_id: quote.id,
    subject_type: "quote",
    party: "customer",
    mechanism: "remote_account",
    signer_user_id: user.id,
  });
  if (sigError) return { error: "sign_failed" };

  // Status flips need elevated rights (quote updates are BO-only in RLS).
  const admin = createAdminClient();
  await admin.from("quotes").update({ status: "accepted" }).eq("id", quote.id);
  await admin.from("jobs").update({ status: "accepted" }).eq("id", quote.job_id).eq("status", "quoted");
  return { ok: true };
}

/** Remote completion sign-off from the customer's own account (spec §3.5). */
export async function customerSignCompletionRemotely(jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { data: job } = await supabase
    .from("jobs")
    .select("id, company_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "not_found" };
  if (!["accepted", "in_progress"].includes(job.status)) return { error: "not_signable" };

  const { data: staffSig } = await supabase
    .from("signatures")
    .select("id")
    .eq("job_id", job.id)
    .eq("subject_type", "completion")
    .in("party", ["bo", "worker"])
    .limit(1)
    .maybeSingle();
  if (!staffSig) return { error: "staff_must_sign_first" };

  const { error: sigError } = await supabase.from("signatures").insert({
    company_id: job.company_id,
    job_id: job.id,
    subject_type: "completion",
    party: "customer",
    mechanism: "remote_account",
    signer_user_id: user.id,
  });
  if (sigError) return { error: "sign_failed" };

  const admin = createAdminClient();
  // The DB trigger still enforces the after-photo requirement here.
  const { error } = await admin.from("jobs").update({ status: "work_done" }).eq("id", job.id);
  if (error) return { error: "after_photo_required" };
  return { ok: true };
}
