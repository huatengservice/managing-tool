"use client";

import { createClient } from "@/lib/supabase/client";

/** Upload a drawn signature PNG to the private signatures bucket. */
export async function uploadSignatureImage(
  companyId: string,
  jobId: string,
  blob: Blob
): Promise<string> {
  const supabase = createClient();
  const path = `${companyId}/${jobId}/${Date.now()}.png`;
  const { error } = await supabase.storage
    .from("signatures")
    .upload(path, blob, { contentType: "image/png" });
  if (error) throw error;
  return path;
}
