"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { treatAction } from "@/app/actions/health";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { HealthDict } from "@/i18n/health";

export function TreatForm({ t, today, tag }: { t: HealthDict; today: string; tag: string }) {
  const f = t.form;
  const [state, action, pending] = useActionState(treatAction, {});
  const ref = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const err = (k: string) => (state.fields?.[k] ? (t.errors[state.fields[k]!] ?? t.errors.invalid) : undefined);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="max-w-3xl">
      <form ref={ref} action={action} className="grid gap-5 sm:grid-cols-2" noValidate>
        {state.ok ? (
          <div className="sm:col-span-2">
            <Notice tone="ok">
              {f.treatmentSaved.replace("{tag}", state.ok)}{" "}
              <Link href={`/app/animals/${encodeURIComponent(state.ok)}`} className="font-semibold text-primary-ink">
                {f.openRecord} →
              </Link>
            </Notice>
          </div>
        ) : null}
        {state.error && !state.fields ? (
          <div className="sm:col-span-2">
            <Notice tone="danger">{t.errors[state.error] ?? t.errors.invalid}</Notice>
          </div>
        ) : null}
        <Field label={f.tag} htmlFor="tag" error={err("tag")}>
          <Input id="tag" name="tag" required defaultValue={v.tag ?? tag} className="uppercase" aria-invalid={Boolean(err("tag"))} />
        </Field>
        <Field label={f.type} htmlFor="type">
          <Select id="type" name="type" defaultValue={v.type ?? "treatment"}>
            {(["treatment", "vet_visit", "observation"] as const).map((k) => (
              <option key={k} value={k}>
                {t.types[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={f.date} htmlFor="date" error={err("date")}>
          <Input id="date" name="date" type="date" max={today} defaultValue={v.date ?? today} />
        </Field>
        <Field label={f.vet} htmlFor="vetName">
          <Input id="vetName" name="vetName" defaultValue={v.vetName} maxLength={80} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={f.diagnosis} htmlFor="diagnosis" error={err("diagnosis")}>
            <Input id="diagnosis" name="diagnosis" defaultValue={v.diagnosis} maxLength={160} aria-invalid={Boolean(err("diagnosis"))} />
          </Field>
        </div>
        <Field label={f.drug} htmlFor="drug">
          <Input id="drug" name="drug" defaultValue={v.drug} maxLength={120} />
        </Field>
        <Field label={f.dose} htmlFor="dose">
          <Input id="dose" name="dose" defaultValue={v.dose} maxLength={120} />
        </Field>
        <Field label={f.milkDays} htmlFor="milkWithdrawalDays" hint={f.withdrawalHint} error={err("milkWithdrawalDays")}>
          <Input id="milkWithdrawalDays" name="milkWithdrawalDays" inputMode="numeric" defaultValue={v.milkWithdrawalDays} aria-invalid={Boolean(err("milkWithdrawalDays"))} />
        </Field>
        <Field label={f.meatDays} htmlFor="meatWithdrawalDays" hint={f.withdrawalHint} error={err("meatWithdrawalDays")}>
          <Input id="meatWithdrawalDays" name="meatWithdrawalDays" inputMode="numeric" defaultValue={v.meatWithdrawalDays} aria-invalid={Boolean(err("meatWithdrawalDays"))} />
        </Field>
        <Field label={f.cost} htmlFor="costTk">
          <Input id="costTk" name="costTk" inputMode="numeric" defaultValue={v.costTk} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={f.notes} htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={v.notes} maxLength={500} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending} className="min-h-12 px-8">
            {f.saveTreatment}
          </Button>
        </div>
      </form>
    </Card>
  );
}
