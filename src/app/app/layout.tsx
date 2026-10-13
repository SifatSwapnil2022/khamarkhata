import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { switchFarmAction } from "@/app/actions/farm";
import { LangToggle } from "@/components/LangToggle";
import { Logo, Select } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { formatBdPhone } from "@/lib/phone";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { NavLinks, type NavItem } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);

  const items: NavItem[] = [{ href: "/app", label: t.nav.overview }];
  if (can(ctx.role, "team.view")) items.push({ href: "/app/team", label: t.nav.team });
  items.push({ href: "/app/settings", label: t.nav.settings });

  const comingNext = [t.nav.animals, t.nav.dairy, t.nav.health, t.nav.breeding, t.nav.qurbani, t.nav.marketplace, t.nav.reports];

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <Link href="/app" className="flex items-center gap-3 text-ink no-underline">
          <Logo />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-extrabold tracking-tight">{t.common.appName}</span>
            <span className="text-[13px] text-muted">{ctx.farm.name}</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {ctx.farms.length > 1 ? (
            <form action={switchFarmAction} className="flex items-center gap-2">
              <label htmlFor="farmId" className="sr-only">
                {t.nav.switchFarm}
              </label>
              <Select id="farmId" name="farmId" defaultValue={ctx.farm.id} className="w-auto max-w-56">
                {ctx.farms.map(({ farm }) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </Select>
              <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-primary hover:bg-surface-2">
                {t.nav.switchFarm}
              </button>
            </form>
          ) : null}
          <LangToggle locale={locale} path="/app" label={t.common.switchTo} />
          <form action={signOutAction}>
            <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2">
              {t.common.signOut}
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] flex-wrap gap-6 px-5 py-6">
        <nav aria-label={t.nav.farm} className="flex-[1_1_200px] md:max-w-60">
          <NavLinks items={items} comingNext={comingNext} soonLabel={t.common.soon} comingNextLabel={t.nav.comingNext} />
          <p className="mt-6 border-t border-line px-3 pt-4 text-sm text-muted">
            {ctx.user.name ?? formatBdPhone(ctx.user.phone)}
            <br />
            {t.roles[ctx.role]}
          </p>
        </nav>
        <main className="min-w-0 flex-[999_1_560px]">{children}</main>
      </div>
    </div>
  );
}
