/**
 * Phone number is the primary identifier for every account (spec §8), and
 * the product uses no SMS anywhere (spec §9). Supabase's native phone auth
 * requires an SMS provider for signup OTPs, so phone+password accounts are
 * stored as email+password under a deterministic internal address derived
 * from the normalized phone. The UI only ever shows the phone number.
 */

/**
 * Hosted Supabase validates email domains (rejects .local), so production
 * uses the app's own Vercel subdomain: it passes validation, is on the
 * Public Suffix List (nobody can register it), and can never receive mail
 * — meaning recovery emails to it are undeliverable by construction.
 * Local dev falls back to the .local domain the local stack accepts.
 */
const PHONE_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_PHONE_EMAIL_DOMAIN ?? "phone.huateng.local";

/** Normalize Taiwan phone input: strip separators, +886 → 0 prefix. */
export function normalizePhone(input: string): string {
  let p = input.replace(/[\s\-().]/g, "");
  if (p.startsWith("+886")) p = "0" + p.slice(4);
  else if (p.startsWith("886")) p = "0" + p.slice(3);
  return p;
}

export function isValidPhone(input: string): boolean {
  const p = normalizePhone(input);
  // Taiwan mobile (09xxxxxxxx) or landline with area code (0x-xxxxxxxx)
  return /^09\d{8}$/.test(p) || /^0\d{8,9}$/.test(p);
}

export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@${PHONE_EMAIL_DOMAIN}`;
}

/** Display helper: 0912345678 → 0912-345-678 */
export function formatPhone(phone: string): string {
  const p = normalizePhone(phone);
  if (/^09\d{8}$/.test(p)) return `${p.slice(0, 4)}-${p.slice(4, 7)}-${p.slice(7)}`;
  return p;
}
