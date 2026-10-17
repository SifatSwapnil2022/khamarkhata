"use client";

import { useActionState, useEffect, useRef } from "react";
import { addExpenseAction } from "@/app/actions/finance";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import type { FinanceDict } from "@/i18n/finance";

export function ExpenseForm({ t, today }: { t: FinanceDict; today: string }) {
  const [state, action, pending] = useActionState(addExpenseAction, {});
  const ref = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const err = (k: string) => (state.fields?.[k] ? (t.errors[state.fields[k]!] ?? t.errors.invalid) : undefined);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4" noValidate>
      {state.ok ? <Notice tone="ok">{t.form.saved}</Notice> : null}
      {state.error && !state.fields ? <Notice tone="danger">{t.errors[state.error] ?? t.errors.invalid}</Notice> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.form.date} htmlFor="exp-date" error={err("date")}>
          <Input id="exp-date" name="date" type="date" max={today} defaultValue={v.date || today} aria-invalid={Boolean(err("date"))} />
        </Field>
        <Field label={t.form.amount} htmlFor="exp-amount" error={err("amountTk")}>
          <Input id="exp-amount" name="amountTk" inputMode="numeric" defaultValue={v.amountTk} aria-invalid={Boolean(err("amountTk"))} />
        </Field>
      </div>
      <Field label={t.form.category} htmlFor="exp-cat">
        <Select id="exp-cat" name="category" defaultValue={v.category || "feed"}>
          {(Object.keys(t.categories) as (keyof FinanceDict["categories"])[]).map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.form.tag} htmlFor="exp-tag" hint={t.form.tagHint} error={err("tag")}>
        <Input id="exp-tag" name="tag" className="uppercase" defaultValue={v.tag} aria-invalid={Boolean(err("tag"))} />
      </Field>
      <Field label={t.form.note} htmlFor="exp-note">
        <Input id="exp-note" name="note" maxLength={300} defaultValue={v.note} />
      </Field>
      <Button type="submit" disabled={pending}>
        {t.form.save}
      </Button>
    </form>
  );
}
