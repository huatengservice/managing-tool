import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { setActiveCompany } from "@/app/auth/actions";

/**
 * Multi-company picker (spec §8): shown only when one account belongs to
 * 2+ companies — the single-company case never reaches this page.
 */
export default async function ChooseCompanyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("company_id, role, companies(name)")
    .eq("user_id", user.id)
    .eq("active", true);

  if (!memberships || memberships.length === 0) redirect("/auth/signup");
  if (memberships.length === 1) {
    await setActiveCompany(memberships[0].company_id);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5">
        <h1 className="text-sm font-bold text-slate-800 mb-1">選擇工作環境</h1>
        <p className="text-xs text-slate-400 mb-4">
          此帳號隸屬於多間公司，請選擇要登入的公司
        </p>
        <div className="space-y-2">
          {memberships.map((m) => (
            <form key={m.company_id} action={setActiveCompany.bind(null, m.company_id)}>
              <button className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 hover:border-amber-300 hover:bg-amber-50/40 text-left">
                <span className="text-sm font-semibold text-slate-700">
                  {(m.companies as unknown as { name: string }).name}
                  <span className="ml-2 text-[11px] font-normal text-slate-400">
                    {m.role === "bo" ? "老闆" : "師傅"}
                  </span>
                </span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
