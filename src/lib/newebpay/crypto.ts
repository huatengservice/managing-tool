import "server-only";

import { createCipheriv, createDecipheriv, createHash } from "crypto";

/**
 * NewebPay (藍新金流) / ezPay crypto helpers. Both product families use the
 * same scheme: querystring payload → AES-256-CBC (merchant HashKey/HashIV)
 * → SHA-256 check value. The TradeSha verification here is what makes the
 * payment webhook trustworthy (spec §15.4) — never accept a notification
 * whose SHA doesn't match.
 */

export interface NewebpayCreds {
  merchantId: string;
  hashKey: string;
  hashIv: string;
}

export function encryptTradeInfo(params: Record<string, string | number>, creds: NewebpayCreds): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v));
  const cipher = createCipheriv("aes-256-cbc", creds.hashKey, creds.hashIv);
  return cipher.update(qs.toString(), "utf8", "hex") + cipher.final("hex");
}

export function decryptTradeInfo(tradeInfo: string, creds: NewebpayCreds): string {
  const decipher = createDecipheriv("aes-256-cbc", creds.hashKey, creds.hashIv);
  decipher.setAutoPadding(false);
  const raw = decipher.update(tradeInfo, "hex", "utf8") + decipher.final("utf8");
  // strip PKCS#7 padding manually (padding chars are control bytes)
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x20]+$/g, "").replace(/[\x01-\x1f]+$/g, "");
}

export function tradeSha(tradeInfo: string, creds: NewebpayCreds): string {
  return createHash("sha256")
    .update(`HashKey=${creds.hashKey}&${tradeInfo}&HashIV=${creds.hashIv}`)
    .digest("hex")
    .toUpperCase();
}

/** Constant-shape verification of a NewebPay notification (spec §15.4). */
export function verifyTradeSha(tradeInfo: string, receivedSha: string, creds: NewebpayCreds): boolean {
  return tradeSha(tradeInfo, creds) === receivedSha.toUpperCase();
}

export function mpgCreds(): NewebpayCreds | null {
  const { NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV } = process.env;
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) return null;
  return { merchantId: NEWEBPAY_MERCHANT_ID, hashKey: NEWEBPAY_HASH_KEY, hashIv: NEWEBPAY_HASH_IV };
}

export function einvoiceCreds(): NewebpayCreds | null {
  const { EZPAY_INVOICE_MERCHANT_ID, EZPAY_INVOICE_HASH_KEY, EZPAY_INVOICE_HASH_IV } = process.env;
  if (!EZPAY_INVOICE_MERCHANT_ID || !EZPAY_INVOICE_HASH_KEY || !EZPAY_INVOICE_HASH_IV) return null;
  return {
    merchantId: EZPAY_INVOICE_MERCHANT_ID,
    hashKey: EZPAY_INVOICE_HASH_KEY,
    hashIv: EZPAY_INVOICE_HASH_IV,
  };
}
