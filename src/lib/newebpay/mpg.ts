import "server-only";

import { encryptTradeInfo, mpgCreds, tradeSha, type NewebpayCreds } from "./crypto";

/**
 * NewebPay MPG (幕前支付) — one-time credit-card checkout for invoices —
 * and 定期定額 (Period) — recurring billing for SaaS subscriptions.
 * Both are browser-POSTed forms; confirmation arrives on the NotifyURL
 * webhook, which is the only place payment state is trusted (spec §15.4).
 */

export interface GatewayForm {
  action: string;
  fields: Record<string, string>;
}

export function isMpgConfigured(): boolean {
  return mpgCreds() !== null;
}

/** One-time card payment form for an invoice. */
export function buildInvoicePaymentForm(input: {
  merchantOrderNo: string;
  amount: number;
  itemDesc: string;
  email?: string;
}): GatewayForm | null {
  const creds = mpgCreds();
  if (!creds) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const tradeInfo = encryptTradeInfo(
    {
      MerchantID: creds.merchantId,
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: "2.0",
      MerchantOrderNo: input.merchantOrderNo,
      Amt: input.amount,
      ItemDesc: input.itemDesc.slice(0, 50),
      NotifyURL: `${appUrl}/api/webhooks/newebpay`,
      ReturnURL: `${appUrl}/pay/result`,
      Email: input.email ?? "",
      LoginType: 0,
      CREDIT: 1,
    },
    creds
  );

  return {
    action: `${process.env.NEWEBPAY_API_URL}/MPG/mpg_gateway`,
    fields: {
      MerchantID: creds.merchantId,
      TradeInfo: tradeInfo,
      TradeSha: tradeSha(tradeInfo, creds),
      Version: "2.0",
    },
  };
}

/** Recurring monthly billing (定期定額) form for a SaaS plan subscription. */
export function buildSubscriptionForm(input: {
  merchantOrderNo: string;
  amountPerPeriod: number;
  description: string;
  payerEmail: string;
}): GatewayForm | null {
  const creds = mpgCreds();
  if (!creds) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const postData = encryptTradeInfo(
    {
      RespondType: "JSON",
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: "1.5",
      LangType: "zh-Tw",
      MerOrderNo: input.merchantOrderNo,
      ProdDesc: input.description.slice(0, 100),
      PeriodAmt: input.amountPerPeriod,
      PeriodType: "M",       // monthly
      PeriodPoint: "01",     // bill on the 1st
      PeriodStartType: "2",  // charge the first period immediately on auth
      PeriodTimes: "99",     // open-ended until cancelled
      PayerEmail: input.payerEmail,
      PaymentInfo: "N",
      OrderInfo: "N",
      ReturnURL: `${appUrl}/bo/billing/result`,
      NotifyURL: `${appUrl}/api/webhooks/newebpay/period`,
    },
    creds
  );

  return {
    action: `${process.env.NEWEBPAY_API_URL}/MPG/period`,
    fields: {
      MerchantID_: creds.merchantId,
      PostData_: postData,
    },
  };
}

export function credsForWebhook(): NewebpayCreds | null {
  return mpgCreds();
}
