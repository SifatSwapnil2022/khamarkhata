import { toBnDigits } from "./bd";

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));

type AgeUnits = { y: string; m: string; d: string };

/** Locale-aware number, date and age formatting, with Bangla digits in Bangla. */
export function formatter(locale: "bn" | "en") {
  const bn = locale === "bn";
  const digits = (s: string) => (bn ? toBnDigits(s) : s);
  const dateFmt = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const shortFmt = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return {
    n(value: number | null | undefined, decimals = 0) {
      if (value == null || Number.isNaN(value)) return "—";
      return digits(value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    },
    tk(value: number | null | undefined) {
      if (value == null) return "—";
      return digits(`৳${Math.round(value).toLocaleString("en-IN")}`);
    },
    date(iso: string | null | undefined) {
      return iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "—";
    },
    short(iso: string | null | undefined) {
      return iso ? shortFmt.format(new Date(`${iso}T00:00:00Z`)) : "—";
    },
    /** 5 y 7 mo · 8 mo · 21 d */
    age(birth: string | null, ref: string, u: AgeUnits) {
      if (!birth) return "—";
      const b = new Date(`${birth}T00:00:00Z`);
      const r = new Date(`${ref}T00:00:00Z`);
      const days = Math.round((r.getTime() - b.getTime()) / 86_400_000);
      if (days < 0) return "—";
      if (days < 60) return digits(`${days} ${u.d}`);
      let months = (r.getUTCFullYear() - b.getUTCFullYear()) * 12 + (r.getUTCMonth() - b.getUTCMonth());
      if (r.getUTCDate() < b.getUTCDate()) months -= 1;
      if (months < 24) return digits(`${months} ${u.m}`);
      const y = Math.floor(months / 12);
      const m = months % 12;
      return digits(m ? `${y} ${u.y} ${m} ${u.m}` : `${y} ${u.y}`);
    },
    digits,
  };
}

export type Fmt = ReturnType<typeof formatter>;
