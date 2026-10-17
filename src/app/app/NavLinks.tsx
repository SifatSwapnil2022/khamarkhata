"use client";

import clsx from "clsx";
import {
  BarChart3,
  CalendarHeart,
  Droplets,
  Ellipsis,
  Landmark,
  LayoutGrid,
  Scale,
  Settings,
  Store,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

/** A cow's head, drawn to sit with the lucide set (24 grid, 2px stroke). */
function CowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 5c0 2 1 3 3 3M19 5c0 2-1 3-3 3" />
      <path d="M8 8h8l1 6a4 4 0 0 1-4 5h-2a4 4 0 0 1-4-5Z" />
      <path d="M8 9 4 10M16 9l4 1" />
      <circle cx="10.5" cy="16" r=".6" fill="currentColor" />
      <circle cx="13.5" cy="16" r=".6" fill="currentColor" />
    </svg>
  );
}

export const ICONS = {
  overview: LayoutGrid,
  animals: CowIcon,
  dairy: Droplets,
  breeding: CalendarHeart,
  health: Stethoscope,
  qurbani: Scale,
  market: Store,
  reports: BarChart3,
  finance: Landmark,
  team: Users,
  settings: Settings,
  more: Ellipsis,
} satisfies Record<string, LucideIcon | typeof CowIcon>;

export type IconName = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label?: string; items: NavItem[] };

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ groups, label }: { groups: NavGroup[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex flex-col gap-6">
      {groups.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label ? <p className="mb-1.5 px-3 text-[13px] font-semibold text-muted">{group.label}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold no-underline transition-colors",
                      active ? "bg-primary-soft text-primary-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon aria-hidden="true" className={clsx("size-5 shrink-0", active ? "text-primary" : "text-muted")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Phone: a fixed tab bar at the bottom, clear of the home-gesture strip. */
export function TabBar({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  // "More" stays lit for any page that isn't one of the other tabs.
  const direct = items.filter((i) => i.icon !== "more");
  const onDirect = direct.some((i) => isActive(pathname, i.href));
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = item.icon === "more" ? !onDirect : isActive(pathname, item.href);
          const Icon = ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold no-underline",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-primary-soft")}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
