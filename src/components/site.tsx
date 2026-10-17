import Link from "next/link";
import { LangToggle } from "@/components/LangToggle";
import { buttonClass, Logo } from "@/components/ui";
import type { Dictionary, Locale } from "@/i18n";

/** Header for the public pages (home, market, listing). */
export function SiteHeader({
  t,
  locale,
  path,
  signedIn,
  tone = "light",
}: {
  t: Dictionary;
  locale: Locale;
  path: string;
  signedIn: boolean;
  tone?: "light" | "overlay";
}) {
  const overlay = tone === "overlay";
  return (
    <header className={overlay ? "absolute inset-x-0 top-0 z-20" : "sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur"}>
      <div className="page-column flex h-[4.5rem] items-center justify-between gap-3">
        <Link href="/" className={`flex items-center gap-2.5 no-underline ${overlay ? "rounded-2xl bg-white/95 py-1.5 pr-3.5 pl-1.5 text-ink shadow-sm" : "text-ink"}`}>
          <Logo size={36} />
          <span className="font-display text-[18px] font-extrabold tracking-[-0.02em] whitespace-nowrap">{t.common.appName}</span>
        </Link>
        <nav aria-label={t.common.appName} className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/market"
            className={`hidden min-h-11 items-center rounded-xl px-3.5 text-[15px] font-semibold no-underline sm:inline-flex ${
              overlay ? "bg-white/90 text-ink hover:bg-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {t.market.title}
          </Link>
          <LangToggle locale={locale} path={path} label={t.common.switchTo} compact />
          <Link href={signedIn ? "/app" : "/login"} className={buttonClass("primary")}>
            {signedIn ? t.common.openFarm : t.common.signIn}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="page-column flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
            <Logo size={32} />
            <span className="font-display text-[17px] font-extrabold tracking-[-0.02em]">{t.common.appName}</span>
          </Link>
          <p className="mt-3 text-sm text-muted">{t.home.footerNote}</p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <li>
            <Link href="/market" className="text-ink-2 no-underline hover:text-primary">
              {t.market.title}
            </Link>
          </li>
          <li>
            <Link href="/login" className="text-ink-2 no-underline hover:text-primary">
              {t.common.signIn}
            </Link>
          </li>
          <li>
            <a href="https://github.com/SifatSwapnil2022/khamarkhata" className="text-ink-2 no-underline hover:text-primary">
              GitHub
            </a>
          </li>
        </ul>
      </div>
      <p className="page-column pb-8 text-[13px] text-muted">{t.home.photoCredit}</p>
    </footer>
  );
}
