import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { EVENT_TYPES, sireOptions, type EventType } from "@/server/breeding";
import { bdToday } from "@/server/common";
import { BreedingTabs } from "../BreedingTabs";
import { BreedingForm } from "./BreedingForm";

export const metadata: Metadata = { title: "Record breeding event" };

export default async function RecordBreedingPage({ searchParams }: { searchParams: Promise<{ tag?: string; type?: string }> }) {
  const [{ t }, ctx, sp] = await Promise.all([getDictionary(), requireFarm(), searchParams]);
  const canObserve = can(ctx.role, "breeding.observe");
  const canRecord = can(ctx.role, "breeding.record");
  if (!canObserve && !canRecord) redirect("/app");
  const allowed: EventType[] = canRecord ? [...EVENT_TYPES] : ["heat"];
  const type = allowed.includes(sp.type as EventType) ? (sp.type as EventType) : allowed[0]!;
  const sires = await sireOptions(await getDb(), ctx.farm.id);

  return (
    <>
      <PageHead title={t.breeding.record}>
        <BreedingTabs current="record" t={t.breeding} />
      </PageHead>
      <div className="page-column pt-5 pb-12">
        <BreedingForm
          t={t.breeding}
          labels={t.animals.profile}
          today={bdToday()}
          initialTag={sp.tag?.slice(0, 20) ?? ""}
          initialType={type}
          allowed={allowed}
          sires={sires}
        />
      </div>
    </>
  );
}
