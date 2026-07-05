/** NT$ display with thousands separators. */
export function ntd(amount: number): string {
  return `NT$${Math.round(amount).toLocaleString()}`;
}

/**
 * Hours are stored structured (spec §3.1); display converts to 天/小時
 * using an 8-hour workday.
 */
export function formatHours(hours: number | null, lang: "zh" | "en"): string {
  if (hours == null) return "—";
  if (hours >= 8) {
    const days = Math.round((hours / 8) * 10) / 10;
    return lang === "en" ? `${days} day${days === 1 ? "" : "s"}` : `${days} 天`;
  }
  return lang === "en" ? `${hours} hr${hours === 1 ? "" : "s"}` : `${hours} 小時`;
}
