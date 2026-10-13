import clsx from "clsx";
import { Languages } from "lucide-react";
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
          "inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors",
          tone === "dark"
            ? "bg-white/10 text-white hover:bg-white/20"
            : "border border-line bg-surface text-ink-2 hover:border-primary/40 hover:text-primary",
        )}
      >
        <Languages aria-hidden="true" className="size-4" />
        {label}
      </button>
    </form>
  );
}
