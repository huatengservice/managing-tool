import "server-only";

import { einvoiceCreds, encryptTradeInfo } from "./crypto";

/**
 * ezPay 電子發票 (統一發票) issuance — NewebPay's invoice product.
 * B2C by default; when the buyer provides a 統一編號 it becomes B2B.
 */

export interface EinvoiceResult {
  ok: boolean;
  invoiceNumber?: string;
  randomNum?: string;
  raw?: unknown;
  error?: string;
}

export async function issueEinvoice(input: {
  orderNo: string;
  amount: number; // NT$, tax-inclusive
  buyerName: string;
  buyerUbn?: string | null;
  itemName: string;
}): Promise<EinvoiceResult> {
  const creds = einvoiceCreds();
  if (!creds) return { ok: false, error: "einvoice_not_configured" };

  const taxRate = 5;
  const amt = Math.round(input.amount / (1 + taxRate / 100));
  const tax = input.amount - amt;

  const postData: Record<string, string | number> = {
    RespondType: "JSON",
    Version: "1.5",
    TimeStamp: Math.floor(Date.now() / 1000),
    MerchantOrderNo: input.orderNo,
    Status: "1", // issue immediately
    Category: input.buyerUbn ? "B2B" : "B2C",
    BuyerName: input.buyerName.slice(0, 60),
    ...(input.buyerUbn ? { BuyerUBN: input.buyerUbn } : { PrintFlag: "Y" }),
    TaxType: "1",
    TaxRate: taxRate,
    Amt: amt,
    TaxAmt: tax,
    TotalAmt: input.amount,
    ItemName: input.itemName.slice(0, 30),
    ItemCount: 1,
    ItemUnit: "式",
    ItemPrice: input.amount,
    ItemAmt: input.amount,
  };

  const body = new URLSearchParams({
    MerchantID_: creds.merchantId,
    PostData_: encryptTradeInfo(postData, creds),
  });

  try {
    const res = await fetch(`${process.env.EZPAY_INVOICE_API_URL}/Api/invoice_issue`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as {
      Status: string;
      Message: string;
      Result?: { InvoiceNumber?: string; RandomNum?: string } | string;
    };
    if (json.Status !== "SUCCESS") return { ok: false, error: json.Message, raw: json };
    const result = typeof json.Result === "string" ? JSON.parse(json.Result) : json.Result;
    return {
      ok: true,
      invoiceNumber: result?.InvoiceNumber,
      randomNum: result?.RandomNum,
      raw: json,
    };
  } catch {
    return { ok: false, error: "einvoice_request_failed" };
  }
}
