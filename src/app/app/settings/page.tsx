import type { Metadata } from "next";
import { Card, Notice } from "@/components/ui";
import { getDictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  const editable = can(ctx.role, "farm.update");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t.settings.title}</h1>
      {editable ? (
        <SettingsForm
          t={t}
          locale={locale}
          farm={{
            name: ctx.farm.name,
            district: ctx.farm.district,
            upazila: ctx.farm.upazila,
            segments: ctx.farm.segments,
            settings: ctx.farm.settings,
          }}
        />
      ) : (
        <Card className="flex flex-col gap-4">
          <Notice tone="warn">{t.settings.readOnly}</Notice>
          <dl className="grid gap-3 sm:grid-cols-2">
            {(["heatCycleDays", "pregnancyCheckDays", "gestationDays", "dryOffDaysBeforeCalving"] as const).map((k) => (
              <div key={k}>
                <dt className="text-sm text-muted">{t.settings[k]}</dt>
                <dd className="font-display text-xl font-bold">
                  {ctx.farm.settings[k]} {t.common.days}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
