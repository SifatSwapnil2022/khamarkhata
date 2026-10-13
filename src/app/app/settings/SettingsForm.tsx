"use client";

import { useActionState } from "react";
import { updateFarmAction, type FormState } from "@/app/actions/farm";
import { FarmFields } from "@/components/FarmFields";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import type { FarmSettings, Segment } from "@/db/schema";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/en";

const RULES = [
  { key: "heatCycleDays", min: 17, max: 25 },
  { key: "pregnancyCheckDays", min: 30, max: 120 },
  { key: "gestationDays", min: 270, max: 295 },
  { key: "dryOffDaysBeforeCalving", min: 30, max: 90 },
] as const;

export function SettingsForm({
  t,
  locale,
  farm,
}: {
  t: Dictionary;
  locale: Locale;
  farm: { name: string; district: string; upazila: string | null; segments: Segment[]; settings: FarmSettings };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateFarmAction, {});

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.done ? <Notice tone="ok">{t.common.saved}</Notice> : null}
      {state.error ? <Notice tone="danger">{t.settings.errors.invalid}</Notice> : null}

      <Card className="flex flex-col gap-5">
        <h2 className="font-display text-lg font-bold">{t.settings.details}</h2>
        <FarmFields t={t.onboarding} locale={locale} defaults={farm} />
      </Card>

      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-lg font-bold">{t.settings.rules}</h2>
          <p className="mt-1 text-sm text-muted">{t.settings.rulesHint}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {RULES.map((r) => (
            <Field key={r.key} label={`${t.settings[r.key]} (${t.common.days})`} htmlFor={r.key} hint={`${r.min}–${r.max}`}>
              <Input
                id={r.key}
                name={r.key}
                type="number"
                inputMode="numeric"
                min={r.min}
                max={r.max}
                required
                defaultValue={farm.settings[r.key]}
                aria-describedby={`${r.key}-hint`}
              />
            </Field>
          ))}
        </div>
      </Card>

      <div>
        <Button type="submit" disabled={pending}>
          {t.common.save}
        </Button>
      </div>
    </form>
  );
}
