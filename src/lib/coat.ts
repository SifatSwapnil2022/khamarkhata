/** Coat colours as farmers say them in Bangla. Anything typed in by hand is shown as typed. */
const COAT_BN: Record<string, string> = {
  black: "কালো",
  white: "সাদা",
  brown: "বাদামি",
  red: "লাল",
  "deep red": "গাঢ় লাল",
  "light red": "হালকা লাল",
  "red-brown": "লালচে বাদামি",
  "reddish brown": "লালচে বাদামি",
  "light brown": "হালকা বাদামি",
  grey: "ছাই রঙ",
  "light grey": "হালকা ছাই রঙ",
  "grey-white": "ছাই-সাদা",
  fawn: "হালকা হলদে বাদামি",
  dun: "মেটে",
  "black and white": "সাদা-কালো",
  "red and white": "লাল-সাদা",
  "brown and white": "বাদামি-সাদা",
  "mostly black, white face": "বেশিরভাগ কালো, মুখ সাদা",
  "fawn with white patches": "হলদে বাদামির মধ্যে সাদা ছোপ",
};

export function coatLabel(colour: string | null | undefined, locale: "bn" | "en") {
  if (!colour) return null;
  return locale === "bn" ? (COAT_BN[colour.trim().toLowerCase()] ?? colour) : colour;
}
