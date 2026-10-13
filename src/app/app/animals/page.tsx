import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, buttonClass, EarTag, EmptyState, PageHead, PillTabs } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import type { AnimalsDict } from "@/i18n/animals";
import { fill, formatter, type Fmt } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import {
  breedOptions,
  farmRefDate,
  groupCounts,
  GROUPS,
  listAnimals,
  PAGE_SIZE,
  SORTS,
  STATUSES,
  type AnimalListItem,
  type Group,
  type Sort,
  type Status,
} from "@/server/animals";
import { AnimalPhoto } from "./AnimalPhoto";
import { FilterBar } from "./FilterBar";

export const metadata: Metadata = { title: "Animals" };

type Search = { group?: string; q?: string; status?: string; breed?: string; sort?: string; page?: string; view?: string };

const pickFrom = <T extends string>(list: readonly T[], v: string | undefined, fallback: T) =>
  (list as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

export default async function AnimalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requireFarm(), searchParams]);
  const a = t.animals;
  const db = await getDb();
  const group = pickFrom<Group>(GROUPS, sp.group, "all");
  const status = sp.status ? pickFrom<Status>(STATUSES, sp.status, "pregnant") : undefined;
  const sort = pickFrom<Sort>(SORTS, sp.sort, "tag");
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const view = sp.view === "table" ? "table" : "grid";
  const q = sp.q?.slice(0, 40);

  const [counts, breeds, { items, total }] = await Promise.all([
    groupCounts(db, ctx.farm.id),
    breedOptions(db, ctx.farm.id),
    listAnimals(db, ctx.farm.id, { group, q, status, breed: sp.breed, sort, page }, ctx.farm.settings.gestationDays),
  ]);
  const fmt = formatter(locale);
  // Ages are shown against the farm's latest record day, the same reference the list uses.
  const today = await farmRefDate(db, ctx.farm.id);

  const href = (patch: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged: Search = { group, q, status, breed: sp.breed, sort: sort === "tag" ? undefined : sort, view: view === "grid" ? undefined : view, page: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "group" && v === "all")) next.set(k, String(v));
    const s = next.toString();
    return `/app/animals${s ? `?${s}` : ""}`;
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <>
      <PageHead
        title={a.title}
        subtitle={fill(a.onFarm, { n: fmt.n(counts.all) })}
        actions={
          can(ctx.role, "animal.write") ? (
            <Link href="/app/animals/new" className={buttonClass("primary")}>
              + {a.add}
            </Link>
          ) : undefined
        }
      >
        <PillTabs
          label={a.title}
          current={group}
          items={GROUPS.map((g) => ({
            key: g,
            href: href({ group: g, status: undefined, breed: undefined, sort: undefined }),
            label: a.groups[g],
            count: fmt.n(counts[g]),
          }))}
        />
      </PageHead>

      <div className="page-column flex flex-col gap-5 pt-5 pb-10">
        <Suspense>
          <FilterBar
            t={a}
            breeds={breeds}
            showMilkSort={group === "all" || group === "cows"}
            showWeightSort={group !== "cows"}
          />
        </Suspense>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-2 tabular" aria-live="polite">
            {fill(a.showing, { from: fmt.n(from), to: fmt.n(to), total: fmt.n(total) })}
          </p>
          <div className="flex rounded-xl bg-surface-2 p-1" role="group" aria-label={a.view.grid + " / " + a.view.table}>
            {(["grid", "table"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v === "grid" ? undefined : v, page: page > 1 ? String(page) : undefined })}
                aria-current={view === v ? "true" : undefined}
                className={clsx(
                  "inline-flex min-h-9 items-center rounded-lg px-4 text-sm font-semibold no-underline",
                  view === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {a.view[v]}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={counts.all === 0 ? a.emptyFarm : a.none}
            action={
              counts.all === 0 && can(ctx.role, "animal.write") ? (
                <Link href="/app/animals/new" className={buttonClass("primary")}>
                  + {a.add}
                </Link>
              ) : undefined
            }
          />
        ) : view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] sm:gap-5">
            {items.map((item, i) => (
              <li key={item.id} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <AnimalCard item={item} a={a} fmt={fmt} today={today} locale={locale} priority={i < 4} />
              </li>
            ))}
          </ul>
        ) : (
          <AnimalTable items={items} a={a} fmt={fmt} today={today} locale={locale} />
        )}

        {pages > 1 ? (
          <nav aria-label={fill(a.page, { n: fmt.n(page) })} className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className={buttonClass("secondary")} rel="prev">
                ← {a.prev}
              </Link>
            ) : null}
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={href({ page: p === 1 ? undefined : String(p) })}
                aria-current={p === page ? "page" : undefined}
                className={clsx(
                  "inline-flex size-11 items-center justify-center rounded-xl text-[15px] font-semibold no-underline",
                  p === page ? "bg-primary text-white" : "text-ink-2 hover:bg-surface",
                )}
              >
                {fmt.n(p)}
              </Link>
            ))}
            {page < pages ? (
              <Link href={href({ page: String(page + 1) })} className={buttonClass("secondary")} rel="next">
                {a.next} →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </>
  );
}

function displayName(item: Pick<AnimalListItem, "name" | "nameBn" | "tag">, locale: "bn" | "en") {
  return (locale === "bn" ? item.nameBn ?? item.name : item.name ?? item.nameBn) ?? item.tag;
}

function keyFigure(item: AnimalListItem, a: AnimalsDict, fmt: Fmt, today: string): { value: string; unit: string; note?: string } {
  if (item.purpose === "dairy") {
    if (!item.milking) return { value: a.profile.stats.dry, unit: "" };
    return { value: fmt.n(item.milkAvg, 1), unit: a.perDay };
  }
  if (item.purpose === "qurbani") {
    return { value: fmt.n(item.weightKg), unit: a.kg, note: item.adg ? `+${fmt.n(item.adg, 2)} ${a.kgPerDay}` : undefined };
  }
  return { value: fmt.n(item.weightKg), unit: a.kg, note: fmt.age(item.birthDate, today, a.ageFmt) };
}

function statusBadges(item: AnimalListItem, a: AnimalsDict, fmt: Fmt) {
  const out: { label: string; tone: "green" | "warn" | "danger" | "plain" }[] = [];
  if (item.inHeat) out.push({ label: a.statuses.heat, tone: "warn" });
  if (item.withdrawal) out.push({ label: a.statuses.withdrawal, tone: "danger" });
  if (item.pregnant) out.push({ label: `${a.statuses.pregnant} · ${fill(a.due, { date: fmt.short(item.expectedCalving) })}`, tone: "green" });
  return out;
}

function subtitleFor(item: AnimalListItem, a: AnimalsDict) {
  const kind = item.purpose === "calf" ? a.calfSex[item.sex] : a.purpose[item.purpose];
  const breed = item.breedLabel ? `${item.breedLabel}${item.breedPercent && item.breedLabel.includes("×") ? ` ${item.breedPercent}%` : ""}` : null;
  return [kind, breed].filter(Boolean).join(" · ");
}

function AnimalCard({
  item,
  a,
  fmt,
  today,
  locale,
  priority,
}: {
  item: AnimalListItem;
  a: AnimalsDict;
  fmt: Fmt;
  today: string;
  locale: "bn" | "en";
  priority: boolean;
}) {
  const fig = keyFigure(item, a, fmt, today);
  const badges = statusBadges(item, a, fmt);
  const name = displayName(item, locale);
  return (
    <Link
      href={`/app/animals/${encodeURIComponent(item.tag)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink no-underline shadow-[var(--shadow-card)] transition duration-200 ease-[var(--ease-out-quint)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="relative">
        <AnimalPhoto
          url={item.photoUrl}
          alt={name}
          noPhotoLabel={a.noPhoto}
          sizes="(min-width: 1240px) 290px, (min-width: 768px) 33vw, 100vw"
          className="aspect-[4/3] w-full"
          priority={priority}
        />
        <EarTag tag={item.tag} tone="solid" className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-4">
        <div>
          <p className="font-display text-[17px] leading-tight font-bold tracking-[-0.02em] group-hover:text-primary sm:text-[19px]">
            {name === item.tag ? <span className="text-muted">{item.tag}</span> : name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted sm:text-sm">{subtitleFor(item, a)}</p>
        </div>
        <div className="mt-auto border-t border-line pt-3">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] tabular sm:text-2xl">{fig.value}</span>
            {fig.unit ? <span className="text-sm text-muted">{fig.unit}</span> : null}
            {fig.note ? <span className="ml-auto hidden text-sm text-muted sm:inline">{fig.note}</span> : null}
          </p>
          {badges.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <Badge key={b.label} tone={b.tone}>
                  {b.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function AnimalTable({ items, a, fmt, today, locale }: { items: AnimalListItem[]; a: AnimalsDict; fmt: Fmt; today: string; locale: "bn" | "en" }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="text-sm text-muted">
            {[a.col.tag, a.col.name, a.col.breed, a.col.age, a.col.shed, a.col.figure, a.col.status].map((h, i) => (
              <th key={h} scope="col" className={clsx("border-b border-line px-4 py-3 font-semibold", i === 5 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const fig = keyFigure(item, a, fmt, today);
            return (
              <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <td className="px-4 py-3">
                  <Link href={`/app/animals/${encodeURIComponent(item.tag)}`} className="no-underline">
                    <EarTag tag={item.tag} />
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/app/animals/${encodeURIComponent(item.tag)}`} className="text-ink">
                    {displayName(item, locale)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-2">{subtitleFor(item, a)}</td>
                <td className="px-4 py-3 text-ink-2 tabular">{fmt.age(item.birthDate, today, a.ageFmt)}</td>
                <td className="px-4 py-3 text-ink-2">{item.shed ?? "—"}</td>
                <td className="px-4 py-3 text-right font-semibold tabular">
                  {fig.value} <span className="text-sm text-muted">{fig.unit}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {statusBadges(item, a, fmt).map((b) => (
                      <Badge key={b.label} tone={b.tone}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
