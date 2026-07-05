import { requireAuthContext } from "@/lib/auth/context";
import { BoShell } from "@/components/bo/shell";

export default async function BoLayout({ children }: { children: React.ReactNode }) {
  // BO-only area: workers/customers are redirected to their own surfaces.
  const ctx = await requireAuthContext("bo");
  return (
    <BoShell companyName={ctx.company.name} planId={ctx.plan.id}>
      {children}
    </BoShell>
  );
}
