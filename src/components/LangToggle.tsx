import { setLocaleAction } from "@/app/actions/auth";
import type { Locale } from "@/i18n";

export function LangToggle({ locale, path, label }: { locale: Locale; path: string; label: string }) {
  const next = locale === "bn" ? "en" : "bn";
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        lang={next}
        className="min-h-11 rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-surface-2"
      >
        {label}
      </button>
    </form>
  );
}
