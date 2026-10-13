import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { switchFarmAction } from "@/app/actions/farm";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { TabBar, TopNav, type NavItem } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);

  const items: NavItem[] = [
    { href: "/app", label: t.nav.overview },
    { href: "/app/animals", label: t.nav.animals },
  ];
  if (can(ctx.role, "team.view")) items.push({ href: "/app/team", label: t.nav.team });
  items.push({ href: "/app/settings", label: t.nav.settings });

  return (
    <div className="min-h-dvh pb-[var(--tabbar)]">
      <header className="bg-deep text-[#f1ead9]">
        <div className="page-column flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-5 md:pt-6">
          <Link href="/app" className="flex min-w-0 items-center gap-3 text-[#f1ead9] no-underline">
            <Logo size={40} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-xl font-extrabold tracking-[-0.01em]">{t.common.appName}</span>
              <span className="truncate text-[13px] text-deep-ink">{ctx.farm.name}</span>
            </span>
          </Link>

          <TopNav items={items} label={t.nav.farm} />

          <div className="flex items-center gap-2">
            {ctx.farms.length > 1 ? (
              <form action={switchFarmAction} className="hidden items-center gap-1 lg:flex">
                <label htmlFor="farmId" className="sr-only">
                  {t.nav.switchFarm}
                </label>
                <select
                  id="farmId"
                  name="farmId"
                  defaultValue={ctx.farm.id}
                  className="min-h-11 max-w-48 rounded-full border border-white/30 bg-transparent px-3 text-sm text-[#f1ead9]"
                >
                  {ctx.farms.map(({ farm }) => (
                    <option key={farm.id} value={farm.id} className="text-ink">
                      {farm.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="min-h-11 rounded-full px-3 text-sm font-semibold text-accent">
                  {t.nav.switchFarm}
                </button>
              </form>
            ) : null}
            <LangToggle locale={locale} path="/app" label={t.common.switchTo} tone="dark" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="min-h-11 rounded-full border border-white/30 px-4 text-sm font-semibold text-[#f1ead9] hover:border-white/60"
              >
                {t.common.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}

      <TabBar items={items} label={t.nav.farm} />
    </div>
  );
}
