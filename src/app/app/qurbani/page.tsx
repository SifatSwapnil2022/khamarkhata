import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Gauge, Scale, TrendingDown, Weight } from "lucide-react";
import { BarChart } from "@/components/charts";
import { Badge, buttonClass, Card, EarTag, EmptyState, PageHead, PillTabs, Section, StatCard, type BadgeTone } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { fatteningBoard, type BullRow } from "@/server/qurbani";
import { AnimalPhoto } from "../animals/AnimalPhoto";

export const metadata: Metadata = { title: "Qurbani" };

const FILTERS = ["all", "behind", "on_track", "ahead", "stale"] as const;
type Filter = (typeof FILTERS)[number];
const TONE: Record<BullRow["status"], BadgeTone> = { ahead: "green", on_track: "plain", behind: "danger", no_plan: "plain" };

export default async function QurbaniPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requireFarm(), searchParams]);
  const canWeigh = can(ctx.role, "weight.record");
  const canMoney = can(ctx.role, "finance.view");
  if (!canWeigh && !canMoney) redirect("/app");
  const q = t.qurbani;
  const { eid, daysToEid, bulls } = await fatteningBoard(await getDb(), ctx.farm.id);
  const fmt = formatter(locale);
  const kg = t.animals.kg;
  const filter: Filter = FILTERS.includes(sp.f as Filter) ? (sp.f as Filter) : "all";

  const withKg = bulls.filter((b) => b.latestKg);
  const avgKg = withKg.length ? withKg.reduce((s, b) => s + b.latestKg!, 0) / withKg.length : 0;
  const withAdg = bulls.filter((b) => b.adg !== null);
  const avgAdg = withAdg.length ? withAdg.reduce((s, b) => s + b.adg!, 0) / withAdg.length : 0;
  const margin = bulls.reduce((s, b) => s + (b.projectedMarginTk ?? 0), 0);
  const behind = bulls.filter((b) => b.status === "behind");
  const stale = (b: BullRow) => (b.staleDays ?? 99) > 21;

  const shown = bulls
    .filter((b) => (filter === "all" ? true : filter === "stale" ? stale(b) : b.status === filter))
    .sort((a, b) => ratio(a) - ratio(b));
  const counts: Record<Filter, number> = {
    all: bulls.length,
    behind: behind.length,
    on_track: bulls.filter((b) => b.status === "on_track").length,
    ahead: bulls.filter((b) => b.status === "ahead").length,
    stale: bulls.filter(stale).length,
  };
  const eidLabel = eid ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${eid.date}T00:00:00Z`)) : "";

  return (
    <>
      <PageHead
        photo={bannerFor("qurbani")}
        eyebrow={eid ? `${fill(q.eid, { year: fmt.digits(String(eid.year)) })} · ${fill(q.eidDays, { n: fmt.n(daysToEid) })}` : ctx.farm.name}
        title={q.title}
        subtitle={eid ? (eid.confirmed ? eidLabel : fill(q.eidExpected, { date: eidLabel })) : q.noEid}
        actions={
          canWeigh ? (
            <Link href="/app/qurbani/weigh" className={buttonClass("light")}>
              <Scale aria-hidden="true" className="size-4" /> {q.weigh}
            </Link>
          ) : undefined
        }
      >
        <PillTabs
          label={q.title}
          current="board"
          items={[
            { key: "board", href: "/app/qurbani", label: q.tabs.board },
            ...(canWeigh ? [{ key: "weigh", href: "/app/qurbani/weigh", label: q.tabs.weigh }] : []),
          ]}
        />
      </PageHead>

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        {bulls.length === 0 ? (
          <EmptyState title={q.noBulls} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard icon={<Weight className="size-5" />} label={q.stats.avgKg} value={fmt.n(avgKg)} unit={kg} note={`${fmt.n(bulls.length)} ${q.stats.bulls.toLowerCase()}`} />
              <StatCard icon={<Gauge className="size-5" />} label={q.stats.adg} value={fmt.n(avgAdg, 2)} unit={t.animals.kgPerDay} />
              <StatCard
                icon={<TrendingDown className="size-5" />}
                label={q.stats.behind}
                value={fmt.n(behind.length)}
                note={q.stats.behindNote}
                tone={behind.length ? "danger" : "green"}
                href="/app/qurbani?f=behind"
              />
              {canMoney ? (
                <StatCard icon={<Coins className="size-5" />} label={q.stats.margin} value={fmt.tk(margin)} note={q.stats.marginNote} tone={margin >= 0 ? "green" : "danger"} />
              ) : (
                <StatCard icon={<Scale className="size-5" />} label={q.filters.stale} value={fmt.n(counts.stale)} tone={counts.stale ? "warn" : undefined} />
              )}
            </div>

            <Section title={q.chart}>
              <Card>
                <p className="mb-3 text-sm text-muted">{q.chartNote}</p>
                <BarChart
                  data={[...bulls]
                    .filter((b) => b.targetKg && b.projectedKg)
                    .sort((a, b) => ratio(a) - ratio(b))
                    .map((b, i, arr) => ({
                      label: b.tag,
                      title: `${b.tag}${b.name ? ` · ${b.name}` : ""}`,
                      value: Math.round(ratio(b) * 100),
                      note: `${fmt.n(b.projectedKg)} / ${fmt.n(b.targetKg)} ${kg}`,
                      flagged: b.status === "behind",
                      tick: i === 0 || i === arr.length - 1,
                    }))}
                  locale={locale}
                  unit="%"
                  name={q.cols.eid}
                  flagLabel={q.status.behind}
                  tableToggle={t.animals.profile.tableToggle}
                  colLabel={q.cols.bull}
                  height={200}
                />
              </Card>
            </Section>

            <Section title={q.tabs.board}>
              <PillTabs
                label={q.tabs.board}
                current={filter}
                items={FILTERS.map((f) => ({ key: f, href: f === "all" ? "/app/qurbani" : `/app/qurbani?f=${f}`, label: q.filters[f], count: fmt.n(counts[f]) }))}
              />
              {shown.length === 0 ? (
                <Card>
                  <p className="text-muted">{q.none}</p>
                </Card>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {shown.map((b) => (
                    <li key={b.id}>
                      <BullCard b={b} fmt={fmt} q={q} kg={kg} canMoney={canMoney} kgPerDay={t.animals.kgPerDay} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function ratio(b: BullRow) {
  return b.targetKg && b.projectedKg ? b.projectedKg / b.targetKg : 0;
}

function BullCard({
  b,
  fmt,
  q,
  kg,
  kgPerDay,
  canMoney,
}: {
  b: BullRow;
  fmt: ReturnType<typeof formatter>;
  q: typeof import("@/i18n/qurbani").qurbaniEn;
  kg: string;
  kgPerDay: string;
  canMoney: boolean;
}) {
  // Progress from purchase weight to target; the marker shows where Eid lands.
  const span = b.targetKg && b.startKg ? b.targetKg - b.startKg : null;
  const nowPct = span && b.latestKg ? Math.max(0, Math.min(100, ((b.latestKg - b.startKg!) / span) * 100)) : 0;
  const eidPct = span && b.projectedKg ? Math.max(0, Math.min(100, ((b.projectedKg - b.startKg!) / span) * 100)) : null;
  return (
    <Link
      href={`/app/animals/${encodeURIComponent(b.tag)}`}
      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-3 text-ink no-underline shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 sm:p-4 lg:grid-cols-[64px_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)]"
    >
      <AnimalPhoto url={b.photoUrl} alt="" noPhotoLabel="" sizes="64px" className="size-14 rounded-xl lg:size-16 [&_span]:hidden [&_svg]:h-7 [&_svg]:w-9" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <EarTag tag={b.tag} />
          <span className="truncate font-semibold">{b.name ?? ""}</span>
          <Badge tone={TONE[b.status]}>{q.status[b.status]}</Badge>
          {b.listed ? <Badge tone="green">{q.listed}</Badge> : null}
        </p>
        <p className="mt-1 truncate text-[13px] text-muted">
          {[b.breed, b.shed, b.latestDate ? fill(q.weighed, { date: fmt.short(b.latestDate) }) : null].filter(Boolean).join(" · ")}
          {b.meatWithdrawalUntil ? <span className="ml-1 font-semibold text-danger-ink">· {fill(q.meatWd, { date: fmt.short(b.meatWithdrawalUntil) })}</span> : null}
        </p>
      </div>
      <div className="col-span-2 lg:col-span-1">
        <div className="relative h-2.5 rounded-full bg-surface-2" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${nowPct}%` }} />
          {eidPct !== null ? (
            <div
              className={clsx("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface", b.status === "behind" ? "border-danger-ink" : "border-primary")}
              style={{ left: `${eidPct}%` }}
            />
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] text-muted tabular">
          {fill(q.progress, { start: fmt.n(b.startKg), now: fmt.n(b.latestKg), target: fmt.n(b.targetKg) })}
        </p>
      </div>
      <div className="col-span-2 grid grid-cols-3 gap-3 border-t border-line pt-2.5 lg:col-span-1 lg:border-0 lg:pt-0">
      <Figure label={q.cols.gain} value={fmt.n(b.adg, 2)} unit={kgPerDay} warn={(b.adg ?? 1) < 0.4} />
      <Figure label={q.cols.eid} value={fmt.n(b.projectedKg)} unit={kg} warn={b.status === "behind"} />
      {canMoney ? (
        <Figure label={q.cols.margin} value={fmt.tk(b.projectedMarginTk)} warn={(b.projectedMarginTk ?? 0) < 0} />
      ) : (
        <Figure label={q.cols.target} value={fmt.n(b.targetKg)} unit={kg} />
      )}
      </div>
    </Link>
  );
}

function Figure({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className={clsx("font-display text-lg font-extrabold tabular", warn && "text-danger-ink")}>
        {value}
        {unit ? <span className="ml-1 font-sans text-[13px] font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}
