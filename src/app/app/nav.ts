import type { Role } from "@/db/schema";
import type { Dictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import type { NavGroup, NavItem } from "./NavLinks";

/** One place decides who sees which section. The pages enforce the same rules server-side. */
export function navGroups(role: Role, t: Dictionary): NavGroup[] {
  const herd: NavItem[] = [{ href: "/app/animals", label: t.nav.animals, icon: "animals" }];
  if (can(role, "milk.record") || can(role, "milk.sales")) herd.push({ href: "/app/dairy", label: t.nav.dairy, icon: "dairy" });
  if (can(role, "breeding.observe") || can(role, "breeding.record"))
    herd.push({ href: "/app/breeding", label: t.nav.breeding, icon: "breeding" });
  herd.push({ href: "/app/health", label: t.nav.health, icon: "health" });
  if (can(role, "weight.record") || can(role, "finance.view")) herd.push({ href: "/app/qurbani", label: t.nav.qurbani, icon: "qurbani" });

  const business: NavItem[] = [];
  if (can(role, "listing.manage")) business.push({ href: "/app/market", label: t.nav.marketplace, icon: "market" });
  if (can(role, "finance.view")) business.push({ href: "/app/finance", label: t.nav.finance, icon: "finance" });

  const farm: NavItem[] = [];
  if (can(role, "team.view")) farm.push({ href: "/app/team", label: t.nav.team, icon: "team" });
  farm.push({ href: "/app/settings", label: t.nav.settings, icon: "settings" });

  return [
    { items: [{ href: "/app", label: t.nav.overview, icon: "overview" }] },
    { label: t.nav.groupHerd, items: herd },
    ...(business.length ? [{ label: t.nav.groupBusiness, items: business }] : []),
    { label: t.nav.groupFarm, items: farm },
  ];
}

/** Phone tabs: the four most-used sections, then "More". */
export function tabItems(role: Role, t: Dictionary): NavItem[] {
  const all = navGroups(role, t).flatMap((g) => g.items);
  const pick = ["overview", "animals", "dairy", "health"] as const;
  const tabs = pick.map((icon) => all.find((i) => i.icon === icon)).filter((i): i is NavItem => Boolean(i));
  tabs.push({ href: "/app/more", label: t.nav.more, icon: "more" });
  return tabs;
}
