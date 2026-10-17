import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LangToggle } from "@/components/LangToggle";
import { Steps } from "@/components/Steps";
import { Logo, Notice } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { formatter } from "@/lib/format";
import { photoAt } from "@/lib/photos";
import { getCurrentUser, safeNext } from "@/server/auth";
import { LoginFlow } from "./LoginFlow";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const [{ locale, t }, current, params] = await Promise.all([getDictionary(), getCurrentUser(), searchParams]);
  if (current) redirect("/app");
  const next = safeNext(params.next);
  const photo = photoAt(2);

  return (
    <div className="grid min-h-dvh bg-surface md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-deep md:block">
        <Image src={photo.url} alt="" fill priority sizes="50vw" className="drift -z-10 object-cover" />
        <div className="flex h-full flex-col justify-between p-8 lg:p-10">
          <Link href="/" className="theme-light flex w-fit items-center gap-3 rounded-2xl bg-white/95 py-2 pr-4 pl-2 text-ink no-underline shadow-sm">
            <Logo size={36} />
            <span className="font-display text-lg font-extrabold tracking-[-0.02em]">{t.common.appName}</span>
          </Link>
          <div className="on-dark max-w-md rounded-2xl bg-deep/95 p-7 text-white">
            <p lang="bn" className="font-display text-5xl leading-none font-extrabold">
              খামার খাতা
            </p>
            <p className="mt-3 text-lg text-deep-ink">{t.common.tagline}</p>
            <p className="mt-5 text-[13px] text-deep-ink/80">
              {t.login.photoBy}{" "}
              <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="text-deep-ink underline-offset-2 hover:underline">
                {photo.credit}
              </a>
            </p>
          </div>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 md:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-ink no-underline md:invisible">
            <Logo size={32} />
            <span className="font-display font-extrabold">{t.common.appName}</span>
          </Link>
          <LangToggle locale={locale} path="/login" label={t.common.switchTo} />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {process.env.DEMO_MODE === "true" ? (
            <div className="mb-6">
              <Notice tone="warn">{t.login.demoBanner}</Notice>
            </div>
          ) : null}
          <LoginFlow t={t.login} next={next} initialPhone={params.demo === "1" && process.env.DEMO_MODE === "true" ? "01700-000001" : ""} />

          {/* Plain instructions, always in view, for anyone who hasn't used an OTP login before */}
          <section aria-labelledby="how-h" className="mt-10 rounded-[20px] bg-primary-soft/60 p-5">
            <h2 id="how-h" className="mb-4 text-[19px] font-extrabold">
              {t.help.loginTitle}
            </h2>
            <Steps steps={t.help.login} digits={formatter(locale).digits} size="sm" />
            <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-[14.5px] text-ink-2">
              {t.help.loginTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <Link href="/help" className="mt-4 inline-flex min-h-11 items-center font-semibold">
              {t.help.moreHelp} →
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
