import Link from "next/link";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { getCurrentUser } from "@/server/auth";

/**
 * Temporary public page. The full home page (video hero, Three.js scene, marketplace preview)
 * is its own phase; this keeps the entry point honest until then.
 */
export default async function HomePage() {
  const [{ locale, t }, current] = await Promise.all([getDictionary(), getCurrentUser()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3 text-ink no-underline">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-xl font-extrabold tracking-tight">{t.common.appName}</span>
            <span className="text-[13px] text-muted">{t.common.appNameAlt}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LangToggle locale={locale} path="/" label={t.common.switchTo} />
          <Link
            href={current ? "/app" : "/login"}
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-white no-underline hover:bg-primary-hover"
          >
            {current ? t.common.openFarm : t.common.signIn}
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-5 pt-10 pb-16 md:grid-cols-[1.15fr_1fr] md:pt-16">
        <section className="flex flex-col justify-center gap-6">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">{t.home.eyebrow}</p>
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.05] font-extrabold tracking-tight text-balance">
            {t.home.title}
          </h1>
          <p className="max-w-[56ch] text-lg text-ink-2">{t.home.lede}</p>
          <div>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-base font-semibold text-white no-underline hover:bg-primary-hover"
            >
              {t.home.cta}
            </Link>
          </div>
        </section>

        <section aria-label={t.home.eyebrow} className="ledger self-center rounded-3xl bg-deep p-6 text-white md:p-8">
          <ol className="flex flex-col">
            {t.home.segments.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-white/15 py-5 last:border-0">
                <span className="font-display text-2xl font-bold text-deep-ink">{i + 1}</span>
                <div>
                  <h2 className="font-display text-xl font-bold">{s.title}</h2>
                  <p className="mt-1 text-deep-ink">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-sm text-muted">{t.home.building}</p>
      </footer>
    </div>
  );
}
