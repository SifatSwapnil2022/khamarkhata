import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { PageHead } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { formatBdPhone } from "@/lib/phone";
import { requireFarm } from "@/server/auth";
import { FarmSwitcher } from "../FarmSwitcher";
import { navGroups } from "../nav";
import { MoreIcon } from "./MoreIcon";

export const metadata = { title: "More" };

/** The phone menu: every section, the farm picker and sign-out. */
export default async function MorePage() {
  const [{ t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const groups = navGroups(ctx.role, t).filter((g) => g.label);
  const farms = ctx.farms.map(({ farm }) => ({ id: farm.id, name: farm.name }));

  return (
    <>
      <PageHead title={t.nav.more} />
      <div className="page-column flex flex-col gap-7 py-6">
        <FarmSwitcher farms={farms} current={ctx.farm.id} label={t.nav.switchFarm} district={ctx.farm.district} />
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2.5 text-[15px] font-semibold text-muted">{group.label}</h2>
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-20 flex-col justify-between gap-2 rounded-2xl border border-line bg-surface p-4 font-semibold text-ink no-underline shadow-[var(--shadow-card)]"
                  >
                    <MoreIcon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
          <div className="text-sm leading-tight">
            <p className="font-semibold">{ctx.user.name ?? formatBdPhone(ctx.user.phone)}</p>
            <p className="text-muted">{t.roles[ctx.role]}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold">
              {t.common.signOut}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
