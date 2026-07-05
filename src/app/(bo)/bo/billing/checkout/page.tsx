import { redirect } from "next/navigation";
import { requireAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isTapPayConfigured } from "@/lib/tappay/server";
import { CheckoutClient } from "./checkout-client";
import type { Plan } from "@/lib/types";

/** Subscription checkout: charge month 1 + store the card token (BO-only, aal2-gated). */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const ctx = await requireAuthContext("bo");
  const { plan: planId } = await searchParams;
  if (planId !== "growth" && planId !== "pro") redirect("/bo/billing");

  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", planId).single();
  if (!plan) redirect("/bo/billing");

  return (
    <CheckoutClient
      plan={plan as Plan}
      companyId={ctx.companyId}
      configured={isTapPayConfigured()}
    />
  );
}
