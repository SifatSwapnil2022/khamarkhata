import type { Metadata } from "next";
import { PageHead, PillTabs } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { requirePermission } from "@/server/auth";
import { bdToday, isoDay } from "@/server/common";
import { WEIGH_GROUPS, weighSheet, type WeighGroup } from "@/server/qurbani";
import { WeighSheet } from "./WeighSheet";

export const metadata: Metadata = { title: "Weigh-in" };

export default async function WeighPage({ searchParams }: { searchParams: Promise<{ group?: string; date?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("weight.record"), searchParams]);
  const q = t.qurbani;
  const today = bdToday();
  const group: WeighGroup = WEIGH_GROUPS.includes(sp.group as WeighGroup) ? (sp.group as WeighGroup) : "qurbani";
  const date = sp.date && isoDay.test(sp.date) && sp.date <= today ? sp.date : today;
  const rows = await weighSheet(await getDb(), ctx.farm.id, group, date);

  return (
    <>
      <PageHead title={q.weigh} subtitle={q.sheet.tapeHint}>
        <PillTabs
          label={q.title}
          current="weigh"
          items={[
            { key: "board", href: "/app/qurbani", label: q.tabs.board },
            { key: "weigh", href: "/app/qurbani/weigh", label: q.tabs.weigh },
          ]}
        />
      </PageHead>
      <div className="page-column pt-5 pb-12">
        <WeighSheet key={`${group}-${date}`} rows={rows} group={group} date={date} today={today} t={q} locale={locale} />
      </div>
    </>
  );
}
