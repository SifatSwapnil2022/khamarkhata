"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function NavLinks({ items, comingNext, soonLabel, comingNextLabel }: {
  items: NavItem[];
  comingNext: string[];
  soonLabel: string;
  comingNextLabel: string;
}) {
  const pathname = usePathname();
  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-11 items-center rounded-[10px] px-3 font-semibold no-underline",
                  active ? "bg-primary-soft text-primary-ink" : "text-ink hover:bg-surface-2",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 mb-1 px-3 text-xs font-semibold tracking-wide text-muted uppercase">{comingNextLabel}</p>
      <ul className="flex flex-col gap-0.5" aria-label={comingNextLabel}>
        {comingNext.map((label) => (
          <li key={label} className="flex min-h-10 items-center justify-between px-3 text-muted">
            <span>{label}</span>
            <span className="text-xs">{soonLabel}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
