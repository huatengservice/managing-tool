"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";
import type { ActionResult } from "@/lib/actions/jobs";

/** BO's private tags about a customer (spec §6) — structured, not free text. */
export async function saveCustomerTags(input: {
  customerId: string;
  companyId: string;
  tags: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("bo_customer_notes").upsert({
    customer_id: input.customerId,
    company_id: input.companyId,
    tags: input.tags,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "update_failed" };
  revalidatePath("/bo/customers");
  return {};
}

const QR_TOKEN_TTL_HOURS = 24;

/**
 * Customer QR opt-in (spec §9): generates the URL encoded into the QR code
 * shown on the BO/Worker device, tied to that specific customer record.
 * Single-use and time-limited (spec §15.8).
 */
export async function createCustomerSignupLink(
  customerId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // RLS-scoped read = access check (BO, or worker on one of their jobs).
  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "not_found" };

  const token = generateToken();
  const admin = createAdminClient();
  const { error } = await admin.from("customer_signup_tokens").insert({
    company_id: customer.company_id,
    customer_id: customer.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + QR_TOKEN_TTL_HOURS * 3600_000).toISOString(),
    created_by: user.id,
  });
  if (error) return { error: "token_failed" };

  return { url: `${process.env.NEXT_PUBLIC_APP_URL}/c/${token}` };
}
