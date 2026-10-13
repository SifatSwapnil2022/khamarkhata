import type { Metadata } from "next";
import { getDb } from "@/db";
import { PageHead } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/server/auth";
import { bdToday, isoDay } from "@/server/common";
import { milkSheet, type MilkSession } from "@/server/dairy";
import { DairyTabs } from "../DairyTabs";
import { MilkSheet } from "./MilkSheet";

export const metadata: Metadata = { title: "Record milk" };

export default async function RecordMilkPage({ searchParams }: { searchParams: Promise<{ date?: string; session?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("milk.record"), searchParams]);
  const today = bdToday();
  const date = sp.date && isoDay.test(sp.date) && sp.date <= today ? sp.date : today;
  // Default to the evening milking after 2 pm.
  const hour = new Date(Date.now() + 6 * 3_600_000).getUTCHours();
  const session: MilkSession = sp.session === "am" || sp.session === "pm" ? sp.session : hour >= 14 ? "pm" : "am";
  const rows = await milkSheet(await getDb(), ctx.farm.id, date, session);

  return (
    <>
      <PageHead title={t.dairy.sheet.title} subtitle={t.dairy.sheet.hint}>
        <DairyTabs current="record" t={t.dairy} canRecord canSales={can(ctx.role, "milk.sales")} />
      </PageHead>
      <div className="page-column pt-5 pb-12">
        <MilkSheet
          key={`${date}-${session}`}
          farmId={ctx.farm.id}
          date={date}
          today={today}
          session={session}
          rows={rows}
          locale={locale}
          t={t.dairy}
          L={t.animals.litre}
        />
      </div>
    </>
  );
}
