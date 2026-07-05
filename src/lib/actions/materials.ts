"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/jobs";

const materialSchema = z.object({
  companyId: z.string().uuid(),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplier: z.string().min(1),
  item: z.string().min(1),
  qty: z.number().positive(),
  unitPrice: z.number().min(0),
  jobId: z.string().uuid().nullable(),
});

export async function addMaterial(input: z.infer<typeof materialSchema>): Promise<ActionResult> {
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const { error } = await supabase.from("materials").insert({
    company_id: d.companyId,
    purchased_on: d.purchasedOn,
    supplier: d.supplier.trim(),
    item: d.item.trim(),
    qty: d.qty,
    unit_price: d.unitPrice,
    job_id: d.jobId,
    created_by: user.id,
  });
  if (error) return { error: "insert_failed" };
  revalidatePath("/bo/materials");
  return {};
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { error: "delete_failed" };
  revalidatePath("/bo/materials");
  return {};
}
