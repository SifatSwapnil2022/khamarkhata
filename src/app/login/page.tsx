import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { getCurrentUser, safeNext } from "@/server/auth";
import { LoginFlow } from "./LoginFlow";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ locale, t }, current, params] = await Promise.all([getDictionary(), getCurrentUser(), searchParams]);
  if (current) redirect("/app");
  const next = safeNext(params.next);

  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="ledger relative hidden flex-col justify-between bg-deep p-10 text-white md:flex">
        <Link href="/" className="flex items-center gap-3 text-white no-underline">
          <Logo />
          <span className="font-display text-xl font-extrabold">{t.common.appName}</span>
        </Link>
        <div>
          <p lang="bn" className="font-display text-[clamp(3rem,6vw,5.5rem)] leading-none font-bold text-white/90">
            খামার খাতা
          </p>
          <p className="mt-4 max-w-sm text-lg text-deep-ink">{t.common.tagline}</p>
        </div>
        <p className="text-sm text-deep-ink">{t.home.eyebrow}</p>
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
          <LoginFlow t={t.login} next={next} />
        </div>
      </main>
    </div>
  );
}
