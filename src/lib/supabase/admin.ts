import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES RLS — spec §15.2: this must never reach the
 * client bundle. The "server-only" import makes any client-side import a
 * build error, and the env var has no NEXT_PUBLIC_ prefix.
 *
 * Use only where RLS cannot express the rule (webhooks, token redemption,
 * cross-user reads after an explicit app-level access check).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
