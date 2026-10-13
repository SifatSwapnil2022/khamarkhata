import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Milk, Syringe, Wallet } from "lucide-react";
import { RankBars } from "@/components/charts";
import { Badge, buttonClass, Card, EarTag, Notice, PageHead, Section, StatCard } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { activeWithdrawals, coverage, dueList, healthCost, recentHealth, type DueItem } from "@/server/health";
import { HealthTabs } from "./HealthTabs";

export const metadata: Metadata = { title: "Health" };

export default async function HealthPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const h = t.health;
  const db = await getDb();
  const [{ items }, wds, cov, cost, recent] = await Promise.all([
    dueList(db, ctx.farm.id),
    activeWithdrawals(db, ctx.farm.id),
    coverage(db, ctx.farm.id),
    healthCost(db, ctx.farm.id, 30),
    recentHealth(db, ctx.farm.id, 12),
  ]);
  const fmt = formatter(locale);
  const canRecord = can(ctx.role, "health.record");
  const overdue = items.filter((i) => i.overdueDays > 0);
  const soon = items.filter((i) => i.overdueDays <= 0);
  const vName = (i: { vaccine: string; vaccineBn: string | null }) => (locale === "bn" ? i.vaccineBn ?? i.vaccine : i.vaccine);

  // Group the due list by vaccine: that's how a vaccination day is planned.
  const byVaccine = new Map<string, DueItem[]>();
  for (const i of items) byVaccine.set(i.vaccineId, [...(byVaccine.get(i.vaccineId) ?? []), i]);
  const groups = [...byVaccine.values()].sort((a, b) => b.filter((x) => x.overdueDays > 0).length - a.filter((x) => x.overdueDays > 0).length);

  return (
    <>
      <PageHead
        photo={bannerFor("health")}
        eyebrow={ctx.farm.name}
        title={h.title}
        subtitle={h.subtitle}
        actions={
          canRecord ? (
            <>
              <Link href="/app/health/vaccinate" className={buttonClass("light")}>
                <Syringe aria-hidden="true" className="size-4" /> {h.vaccinate}
              </Link>
              <Link href="/app/health/treat" className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-5 text-[15px] font-semibold text-white no-underline hover:bg-white/20">
                {h.treat}
              </Link>
            </>
          ) : undefined
        }
      >
        {canRecord ? <HealthTabs current="overview" t={h} /> : null}
      </PageHead>

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<AlertTriangle className="size-5" />}
            label={h.stats.overdue}
            value={fmt.n(overdue.length)}
            note={fill(h.stats.overdueNote, { n: fmt.n(new Set(overdue.map((o) => o.animalId)).size) })}
            tone={overdue.length ? "danger" : "green"}
          />
          <StatCard icon={<CalendarClock className="size-5" />} label={h.stats.soon} value={fmt.n(soon.length)} tone={soon.length ? "warn" : undefined} />
          <StatCard
            icon={<Milk className="size-5" />}
            label={h.stats.milkWd}
            value={fmt.n(wds.filter((w) => w.milkUntil).length)}
            note={`${h.stats.meatWd}: ${fmt.n(wds.filter((w) => w.meatUntil).length)}`}
            tone={wds.length ? "danger" : undefined}
          />
          <StatCard
            icon={<Wallet className="size-5" />}
            label={h.stats.cost}
            value={fmt.tk(cost.cost)}
            note={fill(h.stats.costNote, { n: fmt.n(cost.treatments) })}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Section title={h.due}>
            <p className="-mt-2 text-sm text-muted">{h.dueNote}</p>
            {groups.length === 0 ? (
              <Notice tone="ok">{h.noDue}</Notice>
            ) : (
              <ul className="flex flex-col gap-3">
                {groups.map((list) => {
                  const first = list[0]!;
                  const od = list.filter((x) => x.overdueDays > 0).length;
                  const earliest = list.reduce((m, x) => (x.dueDate < m ? x.dueDate : m), first.dueDate);
                  return (
                    <li key={first.vaccineId}>
                      <Card className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-display text-lg font-bold">{vName(first)}</p>
                            <p className="mt-1 flex flex-wrap gap-1.5 text-sm">
                              <Badge>{fill(h.animalsCount, { n: fmt.n(list.length) })}</Badge>
                              {od ? <Badge tone="danger">{fill(h.overdueBy, { n: fmt.n(Math.max(...list.map((x) => x.overdueDays))) })}</Badge> : null}
                              {!od ? <Badge tone="warn">{fill(h.dueOn, { date: fmt.short(earliest) })}</Badge> : null}
                            </p>
                          </div>
                          {canRecord ? (
                            <Link href={`/app/health/vaccinate?vaccine=${first.vaccineId}&due=1`} className={buttonClass("primary")}>
                              {h.vaccinateThese}
                            </Link>
                          ) : null}
                        </div>
                        <details>
                          <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-primary">{h.showAnimals}</summary>
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {list.map((x) => (
                              <li key={x.animalId}>
                                <Link
                                  href={`/app/animals/${encodeURIComponent(x.tag)}`}
                                  title={`${x.name ?? x.tag} · ${fmt.date(x.dueDate)}`}
                                  className="inline-flex items-center gap-1 rounded-lg no-underline"
                                >
                                  <EarTag tag={x.tag} className={x.overdueDays > 0 ? "!bg-danger-bg !text-danger-ink" : undefined} />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <div className="flex min-w-0 flex-col gap-8">
            <Section title={h.withdrawals}>
              <Card>
                <p className="mb-3 text-sm text-muted">{h.withdrawalsNote}</p>
                {wds.length === 0 ? (
                  <Notice tone="ok">{h.noWithdrawals}</Notice>
                ) : (
                  <ul className="flex flex-col">
                    {wds.map((w) => (
                      <li key={`${w.animalId}-${w.date}`} className="border-t border-line py-3 first:border-0 first:pt-0">
                        <Link href={`/app/animals/${encodeURIComponent(w.tag)}`} className="flex items-center gap-2 font-semibold text-ink no-underline hover:text-primary">
                          <EarTag tag={w.tag} /> {w.name ?? ""}
                        </Link>
                        <p className="mt-1 text-sm text-ink-2">{[w.diagnosis, w.drug].filter(Boolean).join(" · ")}</p>
                        <p className="mt-1.5 flex flex-wrap gap-1.5">
                          {w.milkUntil ? <Badge tone="danger">{fill(h.milkUntil, { date: fmt.short(w.milkUntil) })}</Badge> : null}
                          {w.meatUntil ? <Badge tone="danger">{fill(h.meatUntil, { date: fmt.short(w.meatUntil) })}</Badge> : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Section>

            <Section title={h.coverage}>
              <Card>
                <p className="mb-4 text-sm text-muted">{h.coverageNote}</p>
                <RankBars
                  locale={locale}
                  unit="%"
                  rows={cov.map((c) => {
                    const pct = c.herd ? Math.round((c.covered / c.herd) * 100) : 0;
                    return {
                      label: locale === "bn" ? c.nameBn ?? c.name : c.name,
                      sub: `${fmt.n(c.covered)}/${fmt.n(c.herd)}`,
                      value: pct,
                      tone: pct < 60 ? "danger" : pct < 85 ? "warn" : "primary",
                    };
                  })}
                />
              </Card>
            </Section>
          </div>
        </div>

        <Section title={h.recent}>
          {recent.length === 0 ? (
            <Card>
              <p className="text-muted">{h.noRecent}</p>
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r) => (
                <li key={r.id}>
                  <Card className="h-full">
                    <p className="flex items-center justify-between gap-2 text-sm text-muted">
                      <span>{h.types[r.type]}</span>
                      <span className="tabular">{fmt.date(r.date)}</span>
                    </p>
                    <p className="mt-1 font-semibold">{r.diagnosis ?? r.notes ?? h.types[r.type]}</p>
                    <Link href={`/app/animals/${encodeURIComponent(r.tag)}`} className="mt-2 flex items-center gap-2 text-sm text-ink-2 no-underline hover:text-primary">
                      <EarTag tag={r.tag} /> {r.name ?? ""}
                    </Link>
                    {r.drug ? <p className="mt-2 text-sm text-ink-2">{r.drug}</p> : null}
                    <p className="mt-2 text-[13px] text-muted">{[r.vet, r.cost ? fmt.tk(r.cost) : null].filter(Boolean).join(" · ")}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
