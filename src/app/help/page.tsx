import type { Metadata } from "next";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Steps } from "@/components/Steps";
import { buttonClass } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { formatter } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Help · সাহায্য",
  description: "Step-by-step help for Khamar Khata, in Bangla and English: signing in, adding cows, milk, vaccines, breeding, Qurbani weights and selling.",
};

export default async function HelpPage() {
  const [{ locale, t }, current] = await Promise.all([getDictionary(), getCurrentUser()]);
  const h = t.help;
  const fmt = formatter(locale);
  const card = "scroll-mt-24 rounded-[24px] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7";

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <SiteHeader t={t} locale={locale} path="/help" signedIn={Boolean(current)} />
      <main id="main" className="page-column flex flex-col gap-8 py-8 lg:py-12">
        <header className="max-w-3xl">
          <h1 className="text-[length:var(--text-title)] leading-[1.08] font-extrabold tracking-[-0.025em]">{h.title}</h1>
          <p className="mt-3 text-[18px] leading-relaxed text-ink-2">{h.subtitle}</p>
          <p className="mt-2 text-[15px] text-muted">{h.language}</p>
        </header>

        <nav aria-label={h.contents} className="rounded-[20px] bg-primary-soft/60 p-4">
          <p className="mb-2 text-[14px] font-semibold text-muted">{h.contents}</p>
          <ul className="flex flex-wrap gap-2">
            {[{ id: "login", title: h.loginTitle }, ...h.sections, { id: "install", title: h.installTitle }].map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-surface px-3.5 text-[15px] font-semibold text-ink no-underline shadow-sm hover:text-primary">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-6 lg:grid-cols-2">
          <section id="login" aria-labelledby="login-h" className={card}>
            <h2 id="login-h" className="mb-5 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
              {h.loginTitle}
            </h2>
            <Steps steps={h.login} digits={fmt.digits} />
            <ul className="mt-5 flex list-disc flex-col gap-1.5 pl-5 text-[15.5px] text-ink-2">
              {h.loginTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
              {process.env.DEMO_MODE === "true" ? <li className="font-semibold text-warn-ink">{h.demoTip}</li> : null}
            </ul>
            <Link href={current ? "/app" : "/login"} className={buttonClass("primary", "mt-6 min-h-12 px-6 text-base")}>
              {current ? t.common.openFarm : t.common.signIn}
            </Link>
          </section>

          {h.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className={card}>
              <h2 id={`${s.id}-h`} className="mb-5 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
                {s.title}
              </h2>
              <Steps steps={s.steps} digits={fmt.digits} />
            </section>
          ))}

          <section id="install" aria-labelledby="install-h" className={card}>
            <h2 id="install-h" className="mb-5 flex items-center gap-2.5 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
              <Smartphone aria-hidden="true" className="size-6 text-primary" /> {h.installTitle}
            </h2>
            <div className="flex flex-col gap-6">
              {h.install.map((o) => (
                <div key={o.os}>
                  <h3 className="mb-3 text-[17px] font-bold">{o.os}</h3>
                  <Steps steps={o.steps} digits={fmt.digits} size="sm" />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="sizes-h" className={card}>
            <h2 id="sizes-h" className="mb-4 text-[1.5rem] leading-tight font-extrabold tracking-[-0.02em]">
              {h.sizesTitle}
            </h2>
            <ul className="flex flex-col gap-3 text-[17px] leading-relaxed">
              {h.sizes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h2 className="mt-7 mb-2 text-[1.25rem] font-extrabold">{h.stuckTitle}</h2>
            <p className="text-[17px] leading-relaxed text-ink-2">{h.stuck}</p>
          </section>
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
