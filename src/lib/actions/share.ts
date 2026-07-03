"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";

const SHARE_LINK_TTL_DAYS = 30;

/**
 * Share button (spec §3.6): a secure, unguessable, read-only link for a
 * quote or invoice, surfaced through the device's native share sheet.
 * The share view renders document data only — stored photo originals and
 * their timestamp/GPS metadata are never exposed through it (spec §5).
 */
export async function createShareLink(input: {
  subjectType: "quote" | "invoice";
  subjectId: string;
}): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // RLS-scoped read doubles as the access check: only someone who can see
  // the document can create a share link for it.
  const { data: subject } = await supabase
    .from(input.subjectType === "quote" ? "quotes" : "invoices")
    .select("id, company_id")
    .eq("id", input.subjectId)
    .maybeSingle();
  if (!subject) return { error: "not_found" };

  const token = generateToken();
  const admin = createAdminClient();
  const { error } = await admin.from("share_tokens").insert({
    company_id: subject.company_id,
    subject_type: input.subjectType,
    subject_id: subject.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SHARE_LINK_TTL_DAYS * 86400_000).toISOString(),
    created_by: user.id,
  });
  if (error) return { error: "share_failed" };

  return { url: `${process.env.NEXT_PUBLIC_APP_URL}/s/${token}` };
}
