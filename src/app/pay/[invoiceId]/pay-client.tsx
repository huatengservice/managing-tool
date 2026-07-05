"use client";

import { useRouter } from "next/navigation";
import { TapPayCardForm } from "@/components/tappay-card-form";
import { useT } from "@/lib/i18n/provider";

export function PayClient({ invoiceId }: { invoiceId: string }) {
  const t = useT();
  const router = useRouter();

  async function onPrime(prime: string): Promise<string | null> {
    const res = await fetch("/api/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, prime }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (json.ok) {
      router.push("/pay/done?ok=1");
      return null;
    }
    return json.error === "already_paid"
      ? t("此帳單已完成付款", "This invoice is already paid")
      : t("付款未成功，請確認卡片後再試", "Payment was declined — check the card and retry");
  }

  return (
    <TapPayCardForm
      buttonLabel={t("確認付款", "Pay Now")}
      busyLabel={t("付款處理中…", "Processing…")}
      onPrime={onPrime}
    />
  );
}
