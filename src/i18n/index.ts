import "server-only";
import { cookies } from "next/headers";
import { bn } from "./bn";
import { en, type Dictionary } from "./en";

export type Locale = "bn" | "en";
export const LOCALE_COOKIE = "kk_lang";

const dictionaries: Record<Locale, Dictionary> = { bn, en };

/**
 * Cookie first, otherwise Bangla. Most farmers' phones are set to English even when they read
 * Bangla far more easily, so the browser's language isn't a good guide. The switch is on every page.
 */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return fromCookie === "en" ? "en" : "bn";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export type { Dictionary };
