import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarHeart,
  ChevronRight,
  CircleCheck,
  Droplets,
  HandCoins,
  MessageSquare,
  ShieldAlert,
  Syringe,
  TrendingDown,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { BarChart } from "@/components/charts";
import { buttonClass, Card, EarTag, PageHead, Section } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { DISTRICTS } from "@/lib/bd";
import { fill, formatter } from "@/lib/format";
import { bannerFor } from "@/lib/photos";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { getHerdSummary, herdIsEmpty } from "@/server/herd";
import { overview, recentActivity, type AttentionKind } from "@/server/overview";
import { listTeam } from "@/server/team";

export const metadata: Metadata = { title: "Overview" };

const ICON: Record<AttentionKind, LucideIcon> = {
  milk_missing: Droplets,
  vaccines_overdue: Syringe,
  withdrawal: ShieldAlert,
  breeding_overdue: CalendarHeart,
  milk_drops: TrendingDown,
  bulls_behind: Weight,
  buyer_dues: HandCoins,
  inquiries: MessageSquare,
};
const URGENT: AttentionKind[] = ["withdrawal", "vaccines_overdue", "milk_missing"];

export default async function OverviewPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const d = t.dashboard;
  const h = d.herd;
  const db = await getDb();
  const [herd, ov, activity, team] = await Promise.all([
    getHerdSummary(db, ctx.farm.id),
    overview(db, ctx.farm.id, ctx.role, ctx.farm.settings),
    recentActivity(db, ctx.farm.id, 8),
    listTeam(db, ctx.farm.id),
  ]);
  const fmt = formatter(locale);
  const district = DISTRICTS.find((x) => x.en === ctx.farm.district);
  const hasHerd = !herdIsEmpty(herd);
  const short = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const when = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Dhaka" });

  const steps = [
    can(ctx.role, "team.invite") && team.members.length < 2 && { href: "/app/team", ...d.steps.team },
    can(ctx.role, "farm.update") && { href: "/app/settings", ...d.steps.rules },
    !hasHerd && can(ctx.role, "animal.write") && { href: "/app/animals/new", ...d.steps.animals },
  ].filter(Boolean) as { href: string; title: string; body: string }[];

  const groups = [
    { label: h.milkCows, n: herd.milkCows, note: fill(h.milkingDry, { milking: fmt.n(herd.milkingCows), dry: fmt.n(herd.dryCows) }), href: "/app/animals?group=cows" },
    { label: h.calves, n: herd.heiferCalves + herd.bullCalves, note: fill(h.heifersBulls, { heifers: fmt.n(herd.heiferCalves), bulls: fmt.n(herd.bullCalves) }), href: "/app/animals?group=calves" },
    { label: h.qurbani, n: herd.qurbaniBulls, note: herd.qurbaniAvgKg ? fill(h.avgWeight, { kg: fmt.n(herd.qurbaniAvgKg) }) : "", href: "/app/animals?group=qurbani" },
    { label: h.breedingBulls, n: herd.breedingBulls, note: "", href: "/app/animals?group=breeding" },
  ];
  const total = groups.reduce((s, g) => s + g.n, 0);
  const actText = (a: (typeof activity)[number]) => {
    const tpl = d.acts[a.action] ?? d.actFallback;
    const vals = Object.fromEntries(Object.entries(a.data ?? {}).map(([k, v]) => [k, typeof v === "number" ? fmt.n(v) : String(v ?? "")]));
    return fill(tpl, vals);
  };

  return (
    <>
      <PageHead
        photo={bannerFor("overview")}
        eyebrow={`${ctx.farm.name} · ${locale === "bn" ? district?.bn : district?.en}${ctx.farm.upazila ? `, ${ctx.farm.upazila}` : ""}`}
        title={`${d.hello}${ctx.user.name ? `, ${ctx.user.name.split(" ")[0]}` : ""}`}
        subtitle={hasHerd ? fill(t.animals.onFarm, { n: fmt.n(total) }) : d.farmReady}
      />

      <div className="page-column flex flex-col gap-8 pt-6 pb-12">
        {steps.length > 0 && !hasHerd ? (
          <Card>
            <h2 className="section-title">{d.nextSteps}</h2>
            <ol className="mt-3 flex flex-col">
              {steps.map((s) => (
                <li key={s.title} className="border-t border-line py-3 first:border-0">
                  <Link href={s.href} className="font-semibold">
                    {s.title}
                  </Link>
                  <p className="text-sm text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* What needs doing, most urgent first */}
          <Section title={d.attention}>
            {ov.items.length === 0 ? (
              <Card className="flex items-center gap-3">
                <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-primary" />
                <p className="font-medium">{d.allClear}</p>
              </Card>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                {[...ov.items]
                  .sort((a, b) => Number(URGENT.includes(b.kind)) - Number(URGENT.includes(a.kind)))
                  .map((it) => {
                    const Icon = ICON[it.kind];
                    const urgent = URGENT.includes(it.kind);
                    const text = fill(d.items[it.kind] ?? "", {
                      n: fmt.n(it.count),
                      tk: fmt.tk(it.count),
                      session: it.extra ? (d.sessions[it.extra] ?? "") : "",
                    });
                    return (
                      <li key={it.kind} className="border-t border-line first:border-0">
                        <Link href={it.href} className="flex min-h-14 items-center gap-3 px-4 py-3 text-ink no-underline hover:bg-surface-2/60">
                          <span
                            aria-hidden="true"
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-danger-bg text-danger-ink" : "bg-primary-soft text-primary"}`}
                          >
                            <Icon className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1 text-[15px] font-medium first-letter:uppercase">{text}</span>
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </Section>

          {/* The herd, as one list rather than four identical cards */}
          <Section title={d.herdTitle} aside={d.herdNote}>
            <Card flush>
              <ul>
                {groups.map((g) => (
                  <li key={g.label} className="border-t border-line first:border-0">
                    <Link href={g.href} className="flex items-baseline gap-3 px-5 py-3.5 text-ink no-underline hover:bg-surface-2/60">
                      <span className="w-14 font-display text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular">{fmt.n(g.n)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{g.label}</span>
                        {g.note ? <span className="block text-[13px] text-muted">{g.note}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {ov.dairy ? (
            <Section title={d.milk14} aside={ov.dairy.latest ? `${fmt.n(ov.dairy.latest.am + ov.dairy.latest.pm)} ${h.litres} · ${short.format(new Date(`${ov.dairy.latest.date}T00:00:00Z`))}` : undefined}>
              <Card>
                <BarChart
                  data={ov.dairy.daily.map((x) => ({
                    label: short.format(new Date(`${x.date}T00:00:00Z`)),
                    value: Math.round((x.am + x.pm) * 10) / 10,
                    part: x.withheld > 0 ? Math.round(x.withheld * 10) / 10 : undefined,
                  }))}
                  locale={locale}
                  unit={h.litres}
                  name={t.dairy.litres}
                  flagLabel={t.dairy.withheldFlag}
                  tableToggle={t.animals.profile.tableToggle}
                  colLabel={t.dairy.dayCol}
                  height={190}
                />
              </Card>
            </Section>
          ) : null}

          {ov.money ? (
            <Section title={d.money30}>
              <Card className="flex flex-col gap-4">
                <dl className="flex flex-col divide-y divide-line">
                  {[
                    { label: t.finance.revenue, v: ov.money.revenue, tone: "" },
                    { label: t.finance.expenses, v: ov.money.expenses, tone: "" },
                    { label: t.finance.net, v: ov.money.net, tone: ov.money.net < 0 ? "text-danger-ink" : "text-primary" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0">
                      <dt className="text-[15px] text-muted">{m.label}</dt>
                      <dd className={`font-display text-[22px] font-extrabold tracking-[-0.02em] tabular ${m.tone}`}>
                        {fmt.tkShort(m.v)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <Link href="/app/finance?period=30d" className={buttonClass("secondary", "self-start")}>
                  {d.moneyLink}
                </Link>
              </Card>
            </Section>
          ) : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {can(ctx.role, "breeding.observe") || can(ctx.role, "breeding.record") ? (
            <Section title={d.upcoming}>
              <Card flush>
                {ov.upcoming.length === 0 ? (
                  <p className="p-5 text-muted">{d.upcomingNone}</p>
                ) : (
                  <ul>
                    {ov.upcoming.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-0">
                        <span className="w-20 shrink-0 text-sm text-muted tabular">{short.format(new Date(`${c.next!.date}T00:00:00Z`))}</span>
                        <Link href={`/app/animals/${encodeURIComponent(c.tag)}`} className="no-underline">
                          <EarTag tag={c.tag} />
                        </Link>
                        <span className="min-w-0 flex-1 truncate text-[15px]">{t.breeding.upcoming[c.next!.type]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Section>
          ) : null}

          <Section title={d.activity}>
            <Card flush>
              {activity.length === 0 ? (
                <p className="p-5 text-muted">{d.activityNone}</p>
              ) : (
                <ul>
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-baseline gap-3 border-t border-line px-5 py-3 first:border-0">
                      <span className="w-28 shrink-0 text-[13px] text-muted tabular">{when.format(new Date(a.at))}</span>
                      <span className="min-w-0 flex-1 text-[15px]">
                        <span className="font-semibold">{a.who.startsWith("+880") ? fmt.digits(a.who.replace("+880", "0")) : a.who}</span> {actText(a)}
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
