import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { formatBdPhone } from "@/lib/phone";
import { requireFarm } from "@/server/auth";
import { FarmSwitcher } from "./FarmSwitcher";
import { navGroups, tabItems } from "./nav";
import { SideNav, TabBar } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const groups = navGroups(ctx.role, t);
  const farms = ctx.farms.map(({ farm }) => ({ id: farm.id, name: farm.name }));

  return (
    <div className="min-h-dvh pb-[var(--tabbar)] lg:pl-[17rem]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-line bg-surface lg:flex">
        <Link href="/app" className="flex items-center gap-3 px-6 pt-6 pb-5 text-ink no-underline">
          <Logo size={40} />
          <span className="font-display text-[19px] font-extrabold tracking-[-0.02em]">{t.common.appName}</span>
        </Link>
        <div className="px-4 pb-4">
          <FarmSwitcher farms={farms} current={ctx.farm.id} label={t.nav.switchFarm} district={ctx.farm.district} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SideNav groups={groups} label={t.nav.farm} />
        </div>
        <div className="px-4 pb-3">
          <LangToggle locale={locale} path="/app" label={t.common.switchTo} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-4">
          <div className="min-w-0 text-sm leading-tight">
            <p className="truncate font-semibold">{ctx.user.name ?? formatBdPhone(ctx.user.phone)}</p>
            <p className="text-muted">{t.roles[ctx.role]}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
              {t.common.signOut}
            </button>
          </form>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
        <div className="page-column flex h-16 items-center justify-between gap-3">
          <Link href="/app" className="flex min-w-0 items-center gap-2.5 text-ink no-underline lg:hidden">
            <Logo size={34} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-[17px] font-extrabold tracking-[-0.02em]">{t.common.appName}</span>
              <span className="truncate text-[13px] text-muted">{ctx.farm.name}</span>
            </span>
          </Link>
          <LangToggle locale={locale} path="/app" label={t.common.switchTo} />
        </div>
      </header>

      <main id="main">{children}</main>

      <TabBar items={tabItems(ctx.role, t)} label={t.nav.farm} />
    </div>
  );
}
