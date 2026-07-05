import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, Membership, MembershipRole, Plan, Profile } from "@/lib/types";

export const ACTIVE_COMPANY_COOKIE = "active-company";

export interface AuthContext {
  userId: string;
  profile: Profile | null;
  memberships: Membership[];
  /** The company selected for this session (multi-company picker, spec §8). */
  companyId: string;
  role: MembershipRole;
  company: Company;
  plan: Plan;
}

/**
 * Resolve the signed-in BO/Worker context for server components.
 * Redirects to the right auth step when the session is missing or the
 * multi-company selection hasn't been made yet.
 */
export async function requireAuthContext(requiredRole?: MembershipRole): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("memberships").select("*").eq("user_id", user.id).eq("active", true),
  ]);

  const mine = (memberships ?? []) as Membership[];
  if (mine.length === 0) redirect("/auth/signup");

  const cookieStore = await cookies();
  let companyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  if (!companyId || !mine.some((m) => m.company_id === companyId)) {
    if (mine.length === 1) {
      companyId = mine[0].company_id; // common single-company case: no picker friction
    } else {
      redirect("/auth/choose-company");
    }
  }

  const membership = mine.find((m) => m.company_id === companyId)!;
  if (requiredRole && membership.role !== requiredRole) {
    redirect(membership.role === "bo" ? "/bo/pipeline" : "/worker/jobs");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (!company) redirect("/auth/choose-company");

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", company.plan_id)
    .single();

  return {
    userId: user.id,
    profile: (profile as Profile) ?? null,
    memberships: mine,
    companyId: companyId!,
    role: membership.role,
    company: company as Company,
    plan: plan as Plan,
  };
}

/** Customer-portal context: the auth user linked to customer records via QR opt-in. */
export async function requireCustomerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?as=customer");

  const { data: accounts } = await supabase
    .from("customer_accounts")
    .select("*, customers(*), companies(name)")
    .eq("user_id", user.id);

  if (!accounts || accounts.length === 0) redirect("/auth/login?as=customer");
  return { userId: user.id, accounts };
}
