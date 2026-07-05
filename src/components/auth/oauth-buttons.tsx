"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";

/**
 * The same four options everywhere (spec §8): phone+password is the form
 * above these buttons; Google/Facebook are Supabase built-ins; LINE runs
 * through Supabase's custom OIDC provider support (registered as "line"
 * in the Supabase dashboard — LINE is OIDC-compliant).
 */
export function OAuthButtons({ next }: { next?: string }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  async function oauth(provider: string) {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: { redirectTo },
    });
    if (error) setError(t("此登入方式尚未啟用", "This sign-in method is not enabled yet"));
  }

  return (
    <>
      <div className="flex items-center gap-2 my-2">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-300">{t("或使用", "Or continue with")}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <button
        type="button"
        onClick={() => oauth("google")}
        className="w-full border border-slate-200 rounded-lg py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        {t("使用 Google 繼續", "Continue with Google")}
      </button>
      <button
        type="button"
        onClick={() => oauth("facebook")}
        className="w-full border border-slate-200 rounded-lg py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 mt-2"
      >
        {t("使用 Facebook 繼續", "Continue with Facebook")}
      </button>
      <button
        type="button"
        onClick={() => oauth("line")}
        className="w-full border border-emerald-200 bg-emerald-50 rounded-lg py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 mt-2"
      >
        {t("使用 LINE 繼續", "Continue with LINE")}
      </button>
      {error && <p className="text-xs text-rose-500 mt-2 text-center">{error}</p>}
    </>
  );
}
