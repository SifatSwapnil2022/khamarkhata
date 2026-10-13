"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { exitAnimalAction, type AnimalFormState } from "@/app/actions/animals";
import { Button, buttonClass, Card, Field, Input, Notice } from "@/components/ui";
import type { AnimalsDict } from "@/i18n/animals";

export function ExitForm({ t, tag, today, latestWeight }: { t: AnimalsDict; tag: string; today: string; latestWeight: number | null }) {
  const [state, action, pending] = useActionState<AnimalFormState, FormData>(exitAnimalAction, {});
  const v = state.values ?? {};
  const [kind, setKind] = useState(v.lifecycle ?? "sold");
  const f = t.form;
  const err = (name: string) => {
    const code = state.fields?.[name];
    return code ? (f.errors[code] ?? f.errors.invalid) : undefined;
  };

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="currentTag" value={tag} />
      {state.error ? <Notice tone="danger">{f.errors[state.error] ?? f.errors.invalid}</Notice> : null}
      <Card className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold">{f.exitWhat}</legend>
          <div className="flex max-w-lg gap-2">
            {(["sold", "dead", "culled"] as const).map((k) => (
              <label key={k} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-surface px-3 font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-ink has-[:checked]:font-semibold">
                <input type="radio" name="lifecycle" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {f.exitTypes[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.exitDate} htmlFor="date" error={err("date")}>
            <Input id="date" name="date" type="date" required max={today} defaultValue={v.date ?? today} aria-invalid={Boolean(state.fields?.date)} />
          </Field>
          {kind === "sold" ? (
            <Field label={f.salePrice} htmlFor="priceTk" error={err("priceTk")}>
              <Input id="priceTk" name="priceTk" type="number" inputMode="numeric" min={0} required defaultValue={v.priceTk} aria-invalid={Boolean(state.fields?.priceTk)} />
            </Field>
          ) : null}
        </div>
        {kind === "sold" ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={f.buyerName} htmlFor="buyerName">
              <Input id="buyerName" name="buyerName" maxLength={120} defaultValue={v.buyerName} />
            </Field>
            <Field label={f.buyerPhone} htmlFor="buyerPhone">
              <Input id="buyerPhone" name="buyerPhone" type="tel" inputMode="tel" maxLength={20} defaultValue={v.buyerPhone} />
            </Field>
            <Field label={f.weightKg} htmlFor="weightKg" error={err("weightKg")}>
              <Input id="weightKg" name="weightKg" type="number" inputMode="numeric" min={0} defaultValue={v.weightKg ?? latestWeight?.toString() ?? ""} />
            </Field>
          </div>
        ) : null}
        <Field label={f.exitReason} htmlFor="reason">
          <Input id="reason" name="reason" maxLength={300} defaultValue={v.reason} />
        </Field>
      </Card>
      <Notice tone="warn">{f.exitWarn}</Notice>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? f.saving : f.exitSave}
        </Button>
        <Link href={`/app/animals/${encodeURIComponent(tag)}`} className={buttonClass("secondary")}>
          {f.cancel}
        </Link>
      </div>
    </form>
  );
}
