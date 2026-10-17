import type { Metadata } from "next";
import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass, Card, PillTabs, Select } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { getCurrentUser } from "@/server/auth";
import { bdToday } from "@/server/common";
import { CATEGORIES, categoryCounts, MARKET_PAGE, MARKET_SORTS, searchListings, type Category, type MarketSort } from "@/server/market";

export const metadata: Metadata = {
  title: "Cattle market",
  description: "Qurbani bulls, milking cows, heifers and breeding bulls from Bangladeshi farms that keep records.",
};

type Search = { category?: string; district?: string; q?: string; min?: string; max?: string; sort?: string; page?: string };

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ locale, t }, current, sp] = await Promise.all([getDictionary(), getCurrentUser(), searchParams]);
  const m = t.market;
  const db = await getDb();
  const category = CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;
  const sort = MARKET_SORTS.includes(sp.sort as MarketSort) ? (sp.sort as MarketSort) : "newest";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const toNum = (v?: string) => {
    const n = Number.parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const filters = { category, district: sp.district || undefined, q: sp.q?.slice(0, 60) || undefined, minPrice: toNum(sp.min), maxPrice: toNum(sp.max), sort, page };
  const [{ items, total, districts }, counts] = await Promise.all([searchListings(db, filters), categoryCounts(db)]);
  const fmt = formatter(locale);
  const today = bdToday();
  const pages = Math.max(1, Math.ceil(total / MARKET_PAGE));

  const href = (patch: Partial<Search>) => {
    const merged: Search = { category, district: filters.district, q: filters.q, min: sp.min, max: sp.max, sort: sort === "newest" ? undefined : sort, page: undefined, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/market${s ? `?${s}` : ""}`;
  };
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader t={t} locale={locale} path="/market" signedIn={Boolean(current)} />
      <main id="main">
        <div className="page-column pt-8 pb-4 lg:pt-12">
          <h1 className="text-[length:var(--text-title)] leading-[1.05] font-extrabold">{m.title}</h1>
          <p className="mt-2 max-w-2xl text-[17px] text-ink-2">{m.subtitle}</p>
          <div className="mt-6">
            <PillTabs
              label={m.title}
              current={category ?? "all"}
              items={[
                { key: "all", href: href({ category: undefined }), label: m.categories.all, count: fmt.n(all) },
                ...CATEGORIES.filter((c) => counts[c]).map((c) => ({ key: c, href: href({ category: c }), label: m.categories[c], count: fmt.n(counts[c]!) })),
              ]}
            />
          </div>
        </div>

        <div className="page-column flex flex-col gap-6 pb-14">
          <form method="get" action="/market" className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] sm:items-end">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
              <span className="text-sm font-semibold">{m.search}</span>
              <input
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                className="min-h-11 rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{m.district}</span>
              <Select name="district" defaultValue={filters.district ?? ""}>
                <option value="">{m.anyDistrict}</option>
                {districts.map((d) => (
                  <option key={d.district} value={d.district}>
                    {d.district} ({fmt.n(d.n)})
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{m.sort}</span>
              <Select name="sort" defaultValue={sort}>
                {MARKET_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {m.sorts[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {m.price} · {m.min}
              </span>
              <input name="min" inputMode="numeric" defaultValue={sp.min ?? ""} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px]" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{m.max}</span>
              <input name="max" inputMode="numeric" defaultValue={sp.max ?? ""} className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px]" />
            </label>
            <div className="col-span-2 flex gap-2 sm:col-span-1">
              <button type="submit" className={buttonClass("primary", "flex-1")}>
                {m.apply}
              </button>
              <Link href={category ? `/market?category=${category}` : "/market"} className={buttonClass("ghost")}>
                {m.clear}
              </Link>
            </div>
          </form>

          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-[15px] font-medium text-ink-2" aria-live="polite">
              {fill(m.results, { n: fmt.n(total) })}
            </p>
            <p className="max-w-2xl text-[13px] text-muted">{m.noCertify}</p>
          </div>

          {items.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="font-display text-xl font-bold">{m.none}</p>
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {items.map((item, i) => (
                <li key={item.slug}>
                  <ListingCard item={item} t={t} fmt={fmt} today={today} priority={i < 3} />
                </li>
              ))}
            </ul>
          )}

          {pages > 1 ? (
            <nav aria-label="Pages" className="flex items-center justify-center gap-2">
              {page > 1 ? (
                <Link href={href({ page: String(page - 1) })} className={buttonClass("secondary")} rel="prev">
                  ← {m.prev}
                </Link>
              ) : null}
              <span className="px-3 text-[15px] text-muted tabular">
                {fmt.n(page)} / {fmt.n(pages)}
              </span>
              {page < pages ? (
                <Link href={href({ page: String(page + 1) })} className={buttonClass("secondary")} rel="next">
                  {m.next} →
                </Link>
              ) : null}
            </nav>
          ) : null}

          {!current ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-deep px-6 py-5 text-white">
              <p className="text-[17px] font-semibold">{m.sellCta}</p>
              <Link href="/login" className={buttonClass("light")}>
                {m.sellLink} →
              </Link>
            </div>
          ) : null}
        </div>
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
