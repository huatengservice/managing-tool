"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller details printed on receipts (免用統一發票收據): name, 統編,
 * address, phone. Company UPDATE is BO-only under RLS.
 */
export async function updateCompanyInfo(input: {
  companyId: string;
  name: string;
  taxId: string;
  address: string;
  phone: string;
}): Promise<{ error?: string }> {
  if (!input.name.trim()) return { error: "name_required" };
  if (input.taxId && !/^\d{8}$/.test(input.taxId.trim())) return { error: "invalid_tax_id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      name: input.name.trim(),
      tax_id: input.taxId.trim() || null,
      address: input.address.trim(),
      phone: input.phone.trim(),
    })
    .eq("id", input.companyId);
  if (error) return { error: "update_failed" };

  revalidatePath("/bo", "layout");
  return {};
}
