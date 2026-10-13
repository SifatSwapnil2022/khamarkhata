import "server-only";
import { cookies, headers } from "next/headers";
import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export type Locale = "bn" | "en";
export const LOCALE_COOKIE = "kk_lang";

const dictionaries: Record<Locale, Dictionary> = { bn, en };

/** Cookie first; otherwise Bangla if the browser asks for it, else English. */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (fromCookie === "bn" || fromCookie === "en") return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  return /\bbn\b/i.test(accept) ? "bn" : "en";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export type { Dictionary };
