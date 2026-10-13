"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: text links in the header row, the current one underlined in mustard. */
export function TopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative inline-flex min-h-11 items-center px-3 text-[15px] no-underline transition-colors",
                  active ? "text-[#f1ead9]" : "text-deep-ink hover:text-[#f1ead9]",
                )}
              >
                {item.label}
                {active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-accent" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone: a fixed tab bar at the bottom, clear of the home-gesture strip. */
export function TabBar({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-deep pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex h-[3.75rem] items-center justify-center text-[15px] font-medium no-underline",
                  active ? "text-accent" : "text-deep-ink",
                )}
              >
                {active ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-accent" /> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Secondary tabs inside a page's dark band (e.g. herd groups). Links, so each tab has a URL. */
export function BandTabs({ items, current }: { items: (NavItem & { key: string; count?: string })[]; current: string }) {
  return (
    <div className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {items.map((item) => {
        const active = item.key === current;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "relative inline-flex min-h-12 shrink-0 items-center gap-2 px-3 pb-1 text-[15px] font-semibold no-underline first:pl-0",
              active ? "text-[#f1ead9]" : "text-deep-ink hover:text-[#f1ead9]",
            )}
          >
            {item.label}
            {item.count ? <span className="font-mono text-[13px] font-normal opacity-80">{item.count}</span> : null}
            {active ? <span aria-hidden="true" className="absolute right-3 bottom-0 left-3 h-[3px] bg-accent [:first-child>&]:left-0" /> : null}
          </Link>
        );
      })}
    </div>
  );
}
