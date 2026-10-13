import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Droplets, Milk, ShieldAlert, TrendingUp, Wallet } from "lucide-react";
import { BarChart, RankBars } from "@/components/charts";
import { buttonClass, Card, Notice, PageHead, Section, StatCard } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { bdToday } from "@/server/common";
import { dairyOverview, listBuyers, sessionsRecorded } from "@/server/dairy";
import { DairyTabs } from "./DairyTabs";

export const metadata: Metadata = { title: "Dairy" };

export default async function DairyPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const d = t.dairy;
  const db = await getDb();
  const canRecord = can(ctx.role, "milk.record");
  const canSales = can(ctx.role, "milk.sales");
  if (!canRecord && !canSales) redirect("/app");
  const today = bdToday();
  const [ov, buyers, recorded] = await Promise.all([
    dairyOverview(db, ctx.farm.id, 30),
    canSales ? listBuyers(db, ctx.farm.id) : Promise.resolve([]),
    sessionsRecorded(db, ctx.farm.id, today),
  ]);
  const fmt = formatter(locale);
  const L = t.animals.litre;
  const latest = ov.latest;
  const change = ov.prevWeekAvg ? ((ov.weekAvg - ov.prevWeekAvg) / ov.prevWeekAvg) * 100 : null;
  const due = buyers.reduce((s, b) => s + b.dueTk, 0);
  const owing = buyers.filter((b) => b.dueTk > 0).length;
  const withheld7 = ov.daily.slice(-7).reduce((s, x) => s + x.withheld, 0);
  // Prompt for the milking that should be in by now: morning after 6 am, evening after 5 pm (BD time).
  const hour = new Date(Date.now() + 6 * 3_600_000).getUTCHours();
  const missing = hour >= 17 && !recorded.pm ? "pm" : hour >= 6 && !recorded.am ? "am" : null;

  const short = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <>
      <PageHead
        photo={bannerFor("dairy")}
        eyebrow={ctx.farm.name}
        title={d.title}
        subtitle={d.subtitle}
        actions={
          canRecord ? (
            <Link href="/app/dairy/record" className={buttonClass("light")}>
              <Milk aria-hidden="true" className="size-4" /> {d.record}
            </Link>
          ) : undefined
        }
      >
        <DairyTabs current="overview" t={d} canRecord={canRecord} canSales={canSales} />
      </PageHead>

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        {canRecord && missing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft px-5 py-4">
            <p className="font-semibold text-primary-ink">{fill(d.todayPrompt, { session: d.sessions[missing], date: fmt.date(today) })}</p>
            <Link href={`/app/dairy/record?date=${today}&session=${missing}`} className={buttonClass("primary")}>
              {d.recordNow}
            </Link>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Droplets className="size-5" />}
            label={fill(d.stats.latest, { date: latest ? fmt.short(latest.date) : "—" })}
            value={fmt.n(latest ? latest.am + latest.pm : 0)}
            unit={L}
            note={latest ? fill(d.stats.latestNote, { am: fmt.n(latest.am), pm: fmt.n(latest.pm) }) : undefined}
            tone="green"
          />
          <StatCard
            icon={<TrendingUp className="size-5" />}
            label={d.stats.weekAvg}
            value={fmt.n(ov.weekAvg)}
            unit={`${L}/${locale === "bn" ? "দিন" : "day"}`}
            note={change === null ? undefined : fill(d.stats.weekChange, { pct: `${change >= 0 ? "+" : "−"}${fmt.n(Math.abs(change), 1)}%` })}
          />
          <StatCard
            icon={<Milk className="size-5" />}
            label={d.stats.perCow}
            value={fmt.n(ov.perCow, 1)}
            unit={L}
            note={latest ? fill(d.stats.perCowNote, { n: fmt.n(latest.cows) }) : undefined}
          />
          {canSales ? (
            <StatCard
              icon={<Wallet className="size-5" />}
              label={d.stats.dues}
              value={fmt.tk(due)}
              note={fill(owing === 1 ? d.stats.duesNote1 : d.stats.duesNote, { n: fmt.n(owing) })}
              tone={due > 0 ? "warn" : undefined}
              href="/app/dairy/sales"
            />
          ) : (
            <StatCard
              icon={<ShieldAlert className="size-5" />}
              label={d.stats.withheld}
              value={fmt.n(withheld7)}
              unit={L}
              note={d.stats.withheldNote}
              tone={withheld7 ? "danger" : undefined}
            />
          )}
        </div>

        <Section title={d.chart}>
          <Card>
            <p className="mb-3 text-sm text-muted">{d.chartNote}</p>
            <BarChart
              data={ov.daily.map((x, i) => ({
                label: short.format(new Date(`${x.date}T00:00:00Z`)),
                value: Math.round((x.am + x.pm) * 10) / 10,
                part: x.withheld > 0 ? Math.round(x.withheld * 10) / 10 : undefined,
                note: `${d.sessionsShort.am} ${fmt.n(x.am)} · ${d.sessionsShort.pm} ${fmt.n(x.pm)}`,
                tick: i % 7 === 0,
              }))}
              locale={locale}
              unit={L}
              name={d.litres}
              flagLabel={d.withheldFlag}
              tableToggle={t.animals.profile.tableToggle}
              colLabel={d.dayCol}
            />
          </Card>
        </Section>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section title={d.top} aside={d.topNote}>
            <Card>
              <RankBars
                locale={locale}
                unit={`${L}`}
                decimals={1}
                rows={ov.top.map((c) => ({
                  label: c.tag,
                  sub: (locale === "bn" ? c.nameBn ?? c.name : c.name ?? c.nameBn) ?? undefined,
                  value: c.thisWeek,
                  href: `/app/animals/${encodeURIComponent(c.tag)}`,
                }))}
              />
            </Card>
          </Section>
          <Section title={d.drops}>
            <Card>
              <p className="mb-4 text-sm text-muted">{d.dropsNote}</p>
              {ov.drops.length === 0 ? (
                <Notice tone="ok">{d.noDrops}</Notice>
              ) : (
                <ul className="flex flex-col">
                  {ov.drops.map((c) => (
                    <li key={c.tag} className="flex items-center justify-between gap-3 border-t border-line py-3 first:border-0 first:pt-0">
                      <Link href={`/app/animals/${encodeURIComponent(c.tag)}`} className="min-w-0 truncate font-semibold text-ink no-underline hover:text-primary">
                        {c.tag}
                        <span className="ml-1.5 font-normal text-muted">{(locale === "bn" ? c.nameBn ?? c.name : c.name ?? c.nameBn) ?? ""}</span>
                      </Link>
                      <span className="shrink-0 text-[15px] tabular">
                        {fmt.n(c.lastWeek, 1)} → <strong>{fmt.n(c.thisWeek, 1)}</strong> {L}
                        <span className="ml-2 rounded-full bg-danger-bg px-2 py-0.5 text-[13px] font-semibold text-danger-ink">
                          {fmt.n(c.change)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
