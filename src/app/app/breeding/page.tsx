import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, CalendarHeart, HeartPulse, TimerOff } from "lucide-react";
import { RankBars } from "@/components/charts";
import { Badge, buttonClass, Card, EarTag, Notice, PageHead, Section, StatCard, type BadgeTone } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { fertilityKpis, herdBreeding, sireCatalog, type CowBreeding, type UpcomingType } from "@/server/breeding";
import { addDays } from "@/server/common";
import { BreedingTabs } from "./BreedingTabs";

export const metadata: Metadata = { title: "Breeding" };

const TYPE_FOR: Record<UpcomingType, string> = {
  heat_watch: "heat",
  pd_due: "pregnancy_check",
  dry_off: "dry_off",
  calving: "calving",
  ready_to_serve: "service",
  open_long: "service",
};
const TONE: Record<UpcomingType, BadgeTone> = {
  heat_watch: "warn",
  pd_due: "plain",
  dry_off: "plain",
  calving: "green",
  ready_to_serve: "plain",
  open_long: "danger",
};

export default async function BreedingPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  if (!can(ctx.role, "breeding.observe") && !can(ctx.role, "breeding.record")) redirect("/app");
  const b = t.breeding;
  const db = await getDb();
  const [{ today, cows }, kpi, sires] = await Promise.all([
    herdBreeding(db, ctx.farm.id, ctx.farm.settings),
    fertilityKpis(db, ctx.farm.id),
    sireCatalog(db, ctx.farm.id),
  ]);
  const fmt = formatter(locale);
  const canRecord = can(ctx.role, "breeding.record");
  const horizon = addDays(today, 30);
  const count = (s: CowBreeding["status"]) => cows.filter((c) => c.status === s).length;

  const due = cows.filter((c) => c.next && c.next.date <= horizon).sort((x, y) => x.next!.date.localeCompare(y.next!.date) || x.tag.localeCompare(y.tag));
  const week = addDays(today, 7);
  const buckets = [
    { key: "overdue", title: b.overdue, list: due.filter((c) => c.next!.date < today), danger: true },
    { key: "week", title: b.thisWeek, list: due.filter((c) => c.next!.date >= today && c.next!.date <= week), danger: false },
    { key: "later", title: b.later, list: due.filter((c) => c.next!.date > week), danger: false },
  ].filter((x) => x.list.length);

  const name = (c: CowBreeding) => (locale === "bn" ? c.nameBn ?? c.name : c.name ?? c.nameBn) ?? "";
  const dayFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const SHOW = 10;

  const item = (c: CowBreeding) => {
    const n = c.next!;
    const allowed = n.type === "heat_watch" || canRecord;
    return (
      <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line py-3 first:border-0">
        <span className="w-24 shrink-0 text-sm font-medium text-muted tabular">{n.date === today ? b.today : dayFmt.format(new Date(`${n.date}T00:00:00Z`))}</span>
        <Link href={`/app/animals/${encodeURIComponent(c.tag)}`} className="flex min-w-[9rem] flex-1 items-center gap-2 text-ink no-underline hover:text-primary">
          <EarTag tag={c.tag} />
          <span className="truncate font-semibold">{name(c)}</span>
        </Link>
        <Badge tone={TONE[n.type]}>{b.upcoming[n.type]}</Badge>
        {c.lastService && (n.type === "pd_due" || n.type === "heat_watch") ? (
          <span className="text-[13px] text-muted">
            {t.animals.profile.events.service} {fmt.short(c.lastService.date)}
          </span>
        ) : null}
        {allowed ? (
          <Link
            href={`/app/breeding/record?tag=${encodeURIComponent(c.tag)}&type=${TYPE_FOR[n.type]}`}
            className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold text-primary no-underline hover:bg-primary-soft"
          >
            {b.action[n.type]} →
          </Link>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <PageHead
        photo={bannerFor("breeding")}
        eyebrow={ctx.farm.name}
        title={b.title}
        subtitle={b.subtitle}
        actions={
          <Link href="/app/breeding/record" className={buttonClass("light")}>
            <CalendarHeart aria-hidden="true" className="size-4" /> {b.record}
          </Link>
        }
      >
        <BreedingTabs current="overview" t={b} />
      </PageHead>

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<HeartPulse className="size-5" />}
            label={b.stats.pregnant}
            value={fmt.n(count("pregnant"))}
            note={fill(b.stats.pregnantNote, { n: fmt.n(cows.length) })}
            tone="green"
          />
          <StatCard icon={<CalendarHeart className="size-5" />} label={b.stats.served} value={fmt.n(count("served"))} />
          <StatCard
            icon={<Baby className="size-5" />}
            label={b.stats.calving30}
            value={fmt.n(cows.filter((c) => c.expectedCalving && c.expectedCalving <= horizon).length)}
          />
          <StatCard
            icon={<TimerOff className="size-5" />}
            label={b.stats.openLong}
            value={fmt.n(cows.filter((c) => c.next?.type === "open_long").length)}
            note={b.stats.openLongNote}
            tone={cows.some((c) => c.next?.type === "open_long") ? "danger" : undefined}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Section title={b.calendar}>
            <p className="-mt-2 text-sm text-muted">{b.calendarNote}</p>
            {due.length === 0 ? (
              <Notice tone="ok">{b.nothingDue}</Notice>
            ) : (
              <div className="flex flex-col gap-4">
                {buckets.map((g) => (
                  <Card key={g.key} className={g.danger ? "border-danger-ink/25" : undefined}>
                    <h3 className={`flex items-center justify-between font-display text-lg font-bold ${g.danger ? "text-danger-ink" : ""}`}>
                      {g.title}
                      <span className="text-sm font-semibold text-muted">{fmt.n(g.list.length)}</span>
                    </h3>
                    <ul className="mt-2">{g.list.slice(0, SHOW).map(item)}</ul>
                    {g.list.length > SHOW ? (
                      <details className="group">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary group-open:hidden">
                          {fill(b.showMore, { n: fmt.n(g.list.length - SHOW) })}
                        </summary>
                        <ul className="border-t border-line">{g.list.slice(SHOW).map(item)}</ul>
                      </details>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <div className="flex min-w-0 flex-col gap-8">
            <Section title={b.herdStatus}>
              <Card>
                <RankBars
                  locale={locale}
                  rows={(["pregnant", "served", "fresh", "open", "heifer"] as const)
                    .map((s) => ({ label: b.status[s], value: count(s), tone: s === "open" ? ("warn" as const) : undefined }))
                    .filter((r) => r.value > 0)}
                />
              </Card>
            </Section>

            <Section title={b.kpis}>
              <Card>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  {[
                    { label: b.kpi.conception, value: kpi.conceptionRate === null ? "—" : `${fmt.n(kpi.conceptionRate * 100)}%`, hint: b.kpi.conceptionHint, warn: (kpi.conceptionRate ?? 1) < 0.5 },
                    { label: b.kpi.spc, value: fmt.n(kpi.servicesPerConception, 1), hint: b.kpi.spcHint, warn: (kpi.servicesPerConception ?? 0) > 2 },
                    { label: b.kpi.interval, value: kpi.calvingInterval === null ? "—" : `${fmt.n(kpi.calvingInterval)} ${b.kpi.days}`, hint: b.kpi.intervalHint, warn: (kpi.calvingInterval ?? 0) > 400 },
                    { label: b.kpi.firstService, value: kpi.daysToFirstService === null ? "—" : `${fmt.n(kpi.daysToFirstService)} ${b.kpi.days}`, hint: b.kpi.firstServiceHint, warn: (kpi.daysToFirstService ?? 0) > 90 },
                  ].map((k) => (
                    <div key={k.label}>
                      <dt className="text-sm text-muted">{k.label}</dt>
                      <dd className={`font-display text-2xl font-extrabold tracking-[-0.02em] tabular ${k.warn ? "text-warn-ink" : ""}`}>{k.value}</dd>
                      <dd className="text-[13px] text-muted">{k.hint}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </Section>
          </div>
        </div>

        <Section title={b.sires} aside={b.siresNote}>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="text-sm text-muted">
                  <th scope="col" className="px-4 py-3 font-semibold">{b.sireCols.sire}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{b.sireCols.breed}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{b.sireCols.services}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{b.sireCols.conception}</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">{b.sireCols.calves}</th>
                </tr>
              </thead>
              <tbody>
                {sires.map((s) => {
                  const rate = s.checked ? s.conceived / s.checked : null;
                  return (
                    <tr key={s.key} className="border-t border-line">
                      <td className="px-4 py-3">
                        {s.kind === "bull" ? (
                          <Link href={`/app/animals/${encodeURIComponent(s.code)}`} className="font-semibold text-ink no-underline hover:text-primary">
                            {s.code} {s.name ? <span className="font-normal text-muted">{s.name}</span> : null}
                          </Link>
                        ) : (
                          <span className="font-semibold">{s.code}</span>
                        )}
                        <span className="block text-[13px] text-muted">{[b.kinds[s.kind], s.source].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{s.breed ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular">{fmt.n(s.services)}</td>
                      <td className="px-4 py-3 text-right tabular">
                        {rate === null ? "—" : <Badge tone={rate >= 0.5 ? "green" : "warn"}>{fmt.n(rate * 100)}%</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right tabular">{fmt.n(s.calves)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
