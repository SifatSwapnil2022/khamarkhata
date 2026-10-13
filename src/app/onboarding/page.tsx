import type { Metadata } from "next";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { requireUser } from "@/server/auth";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Set up your farm" };

export default async function OnboardingPage() {
  const [{ locale, t }, { user }] = await Promise.all([getDictionary(), requireUser()]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-display font-extrabold">{t.common.appName}</span>
        </span>
        <LangToggle locale={locale} path="/onboarding" label={t.common.switchTo} />
      </div>
      <main className="py-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t.onboarding.title}</h1>
        <p className="mt-2 text-ink-2">{t.onboarding.subtitle}</p>
        <OnboardingForm t={t.onboarding} locale={locale} defaultName={user.name ?? ""} />
      </main>
    </div>
  );
}
