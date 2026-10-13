import type { Metadata } from "next";
import { PageHead } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { requirePermission } from "@/server/auth";
import { bdToday } from "@/server/common";
import { HealthTabs } from "../HealthTabs";
import { TreatForm } from "./TreatForm";

export const metadata: Metadata = { title: "Record treatment" };

export default async function TreatPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const [{ t }, , sp] = await Promise.all([getDictionary(), requirePermission("health.record"), searchParams]);
  return (
    <>
      <PageHead title={t.health.treat}>
        <HealthTabs current="treat" t={t.health} />
      </PageHead>
      <div className="page-column pt-5 pb-12">
        <TreatForm t={t.health} today={bdToday()} tag={sp.tag?.slice(0, 20) ?? ""} />
      </div>
    </>
  );
}
