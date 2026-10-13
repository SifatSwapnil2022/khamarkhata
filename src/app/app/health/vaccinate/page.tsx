import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { dueList, pickerAnimals, vaccineOptions } from "@/server/health";
import { HealthTabs } from "../HealthTabs";
import { VaccinateForm } from "./VaccinateForm";

export const metadata: Metadata = { title: "Vaccinate" };

export default async function VaccinatePage({ searchParams }: { searchParams: Promise<{ vaccine?: string; due?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("health.record"), searchParams]);
  const db = await getDb();
  const [vaccines, herd, due] = await Promise.all([vaccineOptions(db, ctx.farm.id), pickerAnimals(db, ctx.farm.id), dueList(db, ctx.farm.id)]);
  const vaccineId = vaccines.find((v) => v.id === sp.vaccine)?.id ?? vaccines[0]?.id ?? "";
  // Due animal ids per vaccine, so switching vaccine can offer "select the due ones".
  const dueBy: Record<string, string[]> = {};
  for (const d of due.items) (dueBy[d.vaccineId] ??= []).push(d.animalId);

  return (
    <>
      <PageHead title={t.health.vaccinate}>
        <HealthTabs current="vaccinate" t={t.health} />
      </PageHead>
      <div className="page-column pt-5 pb-12">
        <VaccinateForm
          vaccines={vaccines}
          herd={herd}
          dueBy={dueBy}
          initialVaccine={vaccineId}
          preselectDue={sp.due === "1"}
          today={bdToday()}
          t={t.health}
          locale={locale}
        />
      </div>
    </>
  );
}
