import { requireAuthContext } from "@/lib/auth/context";
import { WorkerShell } from "@/components/worker/shell";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuthContext("worker");
  return (
    <WorkerShell companyName={ctx.company.name} displayName={ctx.profile?.display_name ?? ""}>
      {children}
    </WorkerShell>
  );
}
