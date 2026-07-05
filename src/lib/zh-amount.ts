/**
 * Capital Chinese numerals (大寫金額) for receipts — the anti-tampering
 * convention on Taiwanese financial documents: 12,500 → 壹萬貳仟伍佰元整.
 */

const DIGITS = ["零", "壹", "貳", "參", "肆", "伍", "陸", "柒", "捌", "玖"];
const SMALL_UNITS = ["", "拾", "佰", "仟"];
const GROUP_UNITS = ["", "萬", "億", "兆"];

function fourDigits(n: number): string {
  let out = "";
  let needZero = false;
  for (let pos = 3; pos >= 0; pos--) {
    const d = Math.floor(n / 10 ** pos) % 10;
    if (d === 0) {
      if (out) needZero = true;
    } else {
      if (needZero) out += "零";
      out += DIGITS[d] + SMALL_UNITS[pos];
      needZero = false;
    }
  }
  return out;
}

export function zhAmount(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return "零元整";
  if (n < 0 || !Number.isFinite(n)) return "";

  let rest = n;
  const groups: number[] = [];
  while (rest > 0) {
    groups.unshift(rest % 10000);
    rest = Math.floor(rest / 10000);
  }

  let out = "";
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const unit = GROUP_UNITS[groups.length - 1 - i];
    if (g === 0) continue;
    // A zero-gap between non-zero groups reads as 零 (e.g. 1,000,500 → 壹佰萬零伍佰)
    if (out && groups[i - 1] !== undefined && g < 1000) out += "零";
    out += fourDigits(g) + unit;
  }
  return out + "元整";
}
