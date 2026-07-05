"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/provider";

/**
 * Social login. Owner decision (2026-07-05): Google only — Facebook and
 * LINE were dropped from the original spec's four options. Phone+password
 * remains the primary path everywhere.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  async function google() {
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setError(t("Google 登入暫時無法使用", "Google sign-in is temporarily unavailable"));
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
        onClick={google}
        className="w-full border border-slate-200 rounded-lg py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        {t("使用 Google 繼續", "Continue with Google")}
      </button>
      {error && <p className="text-xs text-rose-500 mt-2 text-center">{error}</p>}
    </>
  );
}
