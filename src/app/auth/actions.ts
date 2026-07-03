"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPhone, normalizePhone, phoneToEmail } from "@/lib/auth/phone";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/context";

const LEGAL_VERSION = "2026-07-03-draft";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

// ---------- phone + password ----------

const credentialsSchema = z.object({
  phone: z.string().refine(isValidPhone, "invalid phone"),
  password: z.string().min(8),
});

export async function signInWithPhone(input: { phone: string; password: string }): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_credentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToEmail(parsed.data.phone),
    password: parsed.data.password,
  });
  if (error) return { error: "invalid_credentials" };
  return { ok: true };
}

/**
 * Public company signup (spec §8): account + tenant + BO membership + 2FA
 * enrollment happens on the next screen. Consent to the (draft) legal docs
 * is recorded per spec §16.
 */
export async function signUpCompany(input: {
  companyName: string;
  taxId?: string;
  phone: string;
  password: string;
  displayName: string;
}): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_credentials" };
  if (!input.companyName.trim()) return { error: "company_name_required" };
  if (input.taxId && !/^\d{8}$/.test(input.taxId.trim())) return { error: "invalid_tax_id" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(input.phone),
    password: input.password,
    options: { data: { phone: normalizePhone(input.phone), display_name: input.displayName } },
  });
  if (error || !data.user) {
    return { error: error?.code === "user_already_exists" ? "phone_taken" : "signup_failed" };
  }

  await supabase.from("profiles").insert({
    user_id: data.user.id,
    phone: normalizePhone(input.phone),
    display_name: input.displayName.trim(),
  });

  const { data: companyId, error: rpcError } = await supabase.rpc("create_company", {
    p_name: input.companyName,
    p_tax_id: input.taxId?.trim() || null,
  });
  if (rpcError) return { error: "signup_failed" };

  await logConsent(companyId as string);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId as string, { path: "/", sameSite: "lax" });
  return { ok: true };
}

/** Worker invite acceptance with phone+password signup (spec §8 step 4). */
export async function acceptInviteWithPassword(input: {
  token: string;
  phone: string;
  password: string;
  displayName: string;
}): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_credentials" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: phoneToEmail(input.phone),
    password: input.password,
    options: { data: { phone: normalizePhone(input.phone), display_name: input.displayName } },
  });
  if (error || !data.user) {
    return { error: error?.code === "user_already_exists" ? "phone_taken" : "signup_failed" };
  }

  await supabase.from("profiles").insert({
    user_id: data.user.id,
    phone: normalizePhone(input.phone),
    display_name: input.displayName.trim(),
  });

  return finalizeInviteAcceptance(input.token);
}

/**
 * Redeem the single-use invite token for the signed-in user (used both by
 * password signups above and by OAuth signups after the callback).
 */
export async function finalizeInviteAcceptance(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: companyId, error } = await supabase.rpc("accept_worker_invite", {
    p_token: token,
  });
  if (error) return { error: "invite_invalid" };

  await logConsent(companyId as string);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId as string, { path: "/", sameSite: "lax" });
  return { ok: true };
}

/** OAuth signups land without a profile row; phone is still required (spec §8). */
export async function completeOAuthProfile(input: {
  phone: string;
  displayName: string;
}): Promise<ActionResult> {
  if (!isValidPhone(input.phone)) return { error: "invalid_phone" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    phone: normalizePhone(input.phone),
    display_name: input.displayName.trim(),
  });
  if (error) return { error: "profile_failed" };
  return { ok: true };
}

/** Company creation for an already-authenticated user (OAuth signup path). */
export async function createCompanyForCurrentUser(input: {
  companyName: string;
  taxId?: string;
}): Promise<ActionResult> {
  if (!input.companyName.trim()) return { error: "company_name_required" };
  if (input.taxId && !/^\d{8}$/.test(input.taxId.trim())) return { error: "invalid_tax_id" };

  const supabase = await createClient();
  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_name: input.companyName,
    p_tax_id: input.taxId?.trim() || null,
  });
  if (error) return { error: "signup_failed" };

  await logConsent(companyId as string);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId as string, { path: "/", sameSite: "lax" });
  return { ok: true };
}

// ---------- multi-company picker (spec §8) ----------

export async function setActiveCompany(companyId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Only allow companies the user actually belongs to.
  const { data } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("company_id", companyId)
    .eq("active", true)
    .maybeSingle();
  if (!data) redirect("/auth/choose-company");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, { path: "/", sameSite: "lax" });
  redirect(data.role === "bo" ? "/bo/pipeline" : "/worker/jobs");
}

// ---------- 2FA backup codes (hashed at rest, spec §15.7) ----------

/** Generate 8 one-time recovery codes; plaintext returned exactly once. */
export async function issueBackupCodes(): Promise<{ codes?: string[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { randomBytes } = await import("crypto");
  const codes = Array.from({ length: 8 }, () => {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });

  const admin = createAdminClient();
  // Re-issuing replaces any previous set.
  await admin.from("mfa_backup_codes").delete().eq("user_id", user.id);
  const rows = await Promise.all(
    codes.map(async (c) => ({ user_id: user.id, code_hash: await bcrypt.hash(c, 10) }))
  );
  const { error } = await admin.from("mfa_backup_codes").insert(rows);
  if (error) return { error: "backup_codes_failed" };
  return { codes };
}

/**
 * Recovery path for a lost authenticator: a valid unused backup code
 * removes the stale TOTP factor so the user can re-enroll a new one.
 * The code is consumed either way it's attempted successfully.
 */
export async function redeemBackupCode(code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("mfa_backup_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .is("used_at", null);

  const normalized = code.trim().toUpperCase();
  for (const row of rows ?? []) {
    if (await bcrypt.compare(normalized, row.code_hash)) {
      await admin.from("mfa_backup_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
      for (const f of factors?.factors ?? []) {
        await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      }
      return { ok: true };
    }
  }
  return { error: "invalid_backup_code" };
}

// ---------- consent logging (spec §16) ----------

async function logConsent(companyId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("consent_logs").insert(
    (["tos", "privacy", "dpa"] as const).map((doc_type) => ({
      user_id: user.id,
      company_id: companyId,
      doc_type,
      doc_version: LEGAL_VERSION,
    }))
  );
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
  redirect("/auth/login");
}
