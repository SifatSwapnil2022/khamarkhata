import clsx from "clsx";
import { setLocaleAction } from "@/app/actions/auth";
import type { Locale } from "@/i18n";

export function LangToggle({
  locale,
  path,
  label,
  tone = "light",
}: {
  locale: Locale;
  path: string;
  label: string;
  tone?: "light" | "dark";
}) {
  const next = locale === "bn" ? "en" : "bn";
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        lang={next}
        className={clsx(
          "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
          tone === "dark"
            ? "border-white/30 text-[#f1ead9] hover:border-white/60"
            : "border-ink/30 text-ink hover:border-ink",
        )}
      >
        {label}
      </button>
    </form>
  );
}
