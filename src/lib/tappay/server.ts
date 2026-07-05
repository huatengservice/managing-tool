import "server-only";

/**
 * TapPay server-side API (Pay by Prime / Pay by Card Token).
 *
 * Owner decision 2026-07-05: payments moved from NewebPay to TapPay.
 * Architecture note vs the old webhook model: TapPay charges are
 * server-to-server and synchronous — OUR server calls TapPay with the
 * secret partner key and gets the result directly, so the payment truth
 * (spec §15.4) is established by an authenticated outbound call instead
 * of a signature-verified inbound webhook.
 *
 * Card numbers never touch our servers: TapPay's SDK renders the card
 * fields in iframes and exchanges them for a one-time `prime` token.
 */

const BASES = {
  sandbox: "https://sandbox.tappaysdk.com",
  production: "https://prod.tappaysdk.com",
} as const;

export interface TapPayResult {
  status: number; // 0 = success
  msg: string;
  rec_trade_id?: string;
  card_secret?: { card_key: string; card_token: string };
  raw: unknown;
}

function config() {
  const { TAPPAY_PARTNER_KEY, TAPPAY_MERCHANT_ID } = process.env;
  if (!TAPPAY_PARTNER_KEY || !TAPPAY_MERCHANT_ID) return null;
  const env = process.env.TAPPAY_ENV === "production" ? "production" : "sandbox";
  return { partnerKey: TAPPAY_PARTNER_KEY, merchantId: TAPPAY_MERCHANT_ID, base: BASES[env] };
}

export function isTapPayConfigured(): boolean {
  return config() !== null;
}

async function post(path: string, body: Record<string, unknown>): Promise<TapPayResult> {
  const cfg = config();
  if (!cfg) return { status: -1, msg: "not_configured", raw: null };
  try {
    const res = await fetch(`${cfg.base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": cfg.partnerKey },
      body: JSON.stringify({ partner_key: cfg.partnerKey, merchant_id: cfg.merchantId, ...body }),
    });
    const json = (await res.json()) as {
      status: number;
      msg: string;
      rec_trade_id?: string;
      card_secret?: { card_key: string; card_token: string };
    };
    return { ...json, raw: json };
  } catch {
    return { status: -2, msg: "request_failed", raw: null };
  }
}

/** One-time charge with a frontend-issued prime. remember=true also returns a reusable card token. */
export function payByPrime(input: {
  prime: string;
  amount: number; // NT$ whole dollars
  details: string;
  orderNumber: string;
  cardholder: { name: string; phone: string; email: string };
  remember?: boolean;
}): Promise<TapPayResult> {
  return post("/tpc/payment/pay-by-prime", {
    prime: input.prime,
    amount: input.amount,
    currency: "TWD",
    details: input.details.slice(0, 100),
    order_number: input.orderNumber,
    cardholder: {
      name: input.cardholder.name,
      phone_number: input.cardholder.phone,
      email: input.cardholder.email,
    },
    remember: input.remember ?? false,
  });
}

/** Recurring charge with a stored card token (SaaS subscription billing). */
export function payByCardToken(input: {
  cardKey: string;
  cardToken: string;
  amount: number;
  details: string;
  orderNumber: string;
}): Promise<TapPayResult> {
  return post("/tpc/payment/pay-by-card-token", {
    card_key: input.cardKey,
    card_token: input.cardToken,
    amount: input.amount,
    currency: "TWD",
    details: input.details.slice(0, 100),
    order_number: input.orderNumber,
  });
}
