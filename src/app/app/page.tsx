import type { Metadata } from "next";
import Link from "next/link";
import { Badge, buttonClass, Card, PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { DISTRICTS, toBnDigits } from "@/lib/bd";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { getHerdSummary, herdIsEmpty } from "@/server/herd";
import { listTeam } from "@/server/team";

export const metadata: Metadata = { title: "Overview" };

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");

export default async function OverviewPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const db = await getDb();
  const [team, herd] = await Promise.all([listTeam(db, ctx.farm.id), getHerdSummary(db, ctx.farm.id)]);
  const district = DISTRICTS.find((d) => d.en === ctx.farm.district);
  const num = (n: number) => (locale === "bn" ? toBnDigits(n.toLocaleString("en-IN")) : n.toLocaleString("en-IN"));
  const h = t.dashboard.herd;
  const hasHerd = !herdIsEmpty(herd);
  const milkDate = herd.latestMilkDate
    ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short" }).format(
        new Date(`${herd.latestMilkDate}T00:00:00Z`),
      )
    : "";

  const steps = [
    can(ctx.role, "team.invite") && team.members.length < 2 && { href: "/app/team", ...t.dashboard.steps.team },
    can(ctx.role, "farm.update") && { href: "/app/settings", ...t.dashboard.steps.rules },
    !hasHerd && { href: null, ...t.dashboard.steps.animals },
  ].filter(Boolean) as { href: string | null; title: string; body: string }[];

  return (
    <>
      <PageHead
        title={`${t.dashboard.hello}${ctx.user.name ? `, ${ctx.user.name.split(" ")[0]}` : ""}`}
        subtitle={`${ctx.farm.name} · ${locale === "bn" ? district?.bn : district?.en}${ctx.farm.upazila ? `, ${ctx.farm.upazila}` : ""}`}
        actions={
          hasHerd ? (
            <Link href="/app/animals" className={buttonClass("accent")}>
              {t.nav.animals} →
            </Link>
          ) : undefined
        }
      />
      <div className="page-column flex flex-col gap-8 py-8">

      {hasHerd ? (
        <section aria-labelledby="herd-title" className="flex flex-col gap-4">
          <h2 id="herd-title" className="rule-title">
            {h.title}
          </h2>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <Stat label={h.milkCows} value={num(herd.milkCows)} note={fill(h.milkingDry, { milking: num(herd.milkingCows), dry: num(herd.dryCows) })} />
            <Stat
              label={h.calves}
              value={num(herd.heiferCalves + herd.bullCalves)}
              note={fill(h.heifersBulls, { heifers: num(herd.heiferCalves), bulls: num(herd.bullCalves) })}
            />
            <Stat
              label={h.qurbani}
              value={num(herd.qurbaniBulls)}
              note={herd.qurbaniAvgKg ? fill(h.avgWeight, { kg: num(herd.qurbaniAvgKg) }) : undefined}
            />
            <Stat label={h.breedingBulls} value={num(herd.breedingBulls)} note={h.breedingNote} />
          </dl>

          <h2 className="rule-title mt-4">{h.today}</h2>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
            <Stat
              label={fill(h.milkOn, { date: milkDate })}
              value={`${num(herd.latestMilkLitres)} ${h.litres}`}
              tone="green"
            />
            <Stat label={h.pregnant} value={num(herd.pregnant)} />
            <Stat label={h.inHeat} value={num(herd.inHeatOnLatestDay)} tone={herd.inHeatOnLatestDay ? "warn" : undefined} />
            <Stat
              label={h.withdrawal}
              value={num(herd.underMilkWithdrawal)}
              note={herd.underMilkWithdrawal ? h.withdrawalNote : undefined}
              tone={herd.underMilkWithdrawal ? "danger" : undefined}
            />
            <Stat label={h.fmdOverdue} value={num(herd.fmdOverdue)} tone={herd.fmdOverdue ? "warn" : undefined} />
          </dl>
          
        </section>
      ) : null}

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Card>
          <dt className="text-sm text-muted">{t.dashboard.facts.segments}</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {ctx.farm.segments.map((s) => (
              <Badge key={s} tone="green">
                {t.segments[s]}
              </Badge>
            ))}
          </dd>
        </Card>
        <Card>
          <dt className="text-sm text-muted">{t.dashboard.facts.members}</dt>
          <dd className="mt-1 font-display text-3xl font-bold">{num(team.members.length)}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-muted">{t.dashboard.facts.yourRole}</dt>
          <dd className="mt-1 font-display text-xl font-bold">{t.roles[ctx.role]}</dd>
        </Card>
      </dl>

      {steps.length > 0 ? (
        <Card>
          <h2 className="font-display text-lg font-bold">{t.dashboard.nextSteps}</h2>
          <ol className="mt-3 flex flex-col">
            {steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4 last:border-0">
                <span className="font-display text-lg font-bold text-muted">{num(i + 1)}</span>
                <div>
                  {s.href ? (
                    <Link href={s.href} className="font-semibold text-primary">
                      {s.title} →
                    </Link>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-2">
                      {s.title} <Badge>{t.common.soon}</Badge>
                    </span>
                  )}
                  <p className="mt-0.5 text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
      </div>
    </>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "green" | "warn" | "danger" }) {
  const accent = tone === "green" ? "text-primary-ink" : tone === "warn" ? "text-warn-ink" : tone === "danger" ? "text-danger-ink" : "text-ink";
  return (
    <Card>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`mt-1 font-display text-3xl font-bold ${accent}`}>{value}</dd>
      {note ? <dd className="mt-0.5 text-sm text-muted">{note}</dd> : null}
    </Card>
  );
}
