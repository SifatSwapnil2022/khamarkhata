const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Converts Bangla digits to ASCII so "০১৭১২…" is accepted like "01712…". */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/**
 * Normalizes a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX).
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX, +8801XXXXXXXXX, with spaces, dashes or Bangla digits.
 * Operator prefixes 013–019 are valid. Returns null for anything else.
 */
export function normalizeBdPhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[\s\-().]/g, "");
  const match = /^(?:\+?88)?(01[3-9]\d{8})$/.exec(digits);
  return match ? `+88${match[1]}` : null;
}

/** +8801712345678 → 01712-345678 */
export function formatBdPhone(e164: string): string {
  const local = e164.replace(/^\+88/, "");
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** Shows only the last three digits, for messages like "code sent to …678". */
export function maskPhone(e164: string): string {
  const local = e164.replace(/^\+88/, "");
  return `${local.slice(0, 3)}•••••${local.slice(-3)}`;
}
