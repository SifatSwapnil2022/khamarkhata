import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { DISTRICTS, toBnDigits } from "@/lib/bd";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { listTeam } from "@/server/team";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const team = await listTeam(await getDb(), ctx.farm.id);
  const district = DISTRICTS.find((d) => d.en === ctx.farm.district);
  const num = (n: number) => (locale === "bn" ? toBnDigits(n) : String(n));

  const steps = [
    can(ctx.role, "team.invite") && { href: "/app/team", ...t.dashboard.steps.team, ready: true },
    can(ctx.role, "farm.update") && { href: "/app/settings", ...t.dashboard.steps.rules, ready: true },
    { href: null, ...t.dashboard.steps.animals, ready: false },
  ].filter(Boolean) as { href: string | null; title: string; body: string; ready: boolean }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t.dashboard.hello}
          {ctx.user.name ? `, ${ctx.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-ink-2">{t.dashboard.farmReady}</p>
      </div>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Card>
          <dt className="text-sm text-muted">{t.dashboard.facts.district}</dt>
          <dd className="mt-1 font-display text-xl font-bold">
            {locale === "bn" ? district?.bn : district?.en}
            {ctx.farm.upazila ? <span className="block text-sm font-normal text-muted">{ctx.farm.upazila}</span> : null}
          </dd>
        </Card>
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
    </div>
  );
}
