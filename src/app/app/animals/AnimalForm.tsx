"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AnimalFormState } from "@/app/actions/animals";
import { Button, buttonClass, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { AnimalsDict } from "@/i18n/animals";

export type AnimalFormDefaults = Partial<Record<string, string>>;

type Options = {
  sheds: { id: string; name: string }[];
  dams: { tag: string; name: string | null }[];
  bulls: { tag: string; name: string | null }[];
  straws: { code: string; breedLabel: string | null }[];
  breeds: string[];
};

export function AnimalForm({
  t,
  action,
  defaults = {},
  options,
  cancelHref,
  currentTag,
  today,
}: {
  t: AnimalsDict;
  action: (prev: AnimalFormState, form: FormData) => Promise<AnimalFormState>;
  defaults?: AnimalFormDefaults;
  options: Options;
  cancelHref: string;
  currentTag?: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<AnimalFormState, FormData>(action, {});
  const v = { ...defaults, ...state.values };
  const [origin, setOrigin] = useState(v.origin ?? "born");
  const f = t.form;
  const err = (name: string) => {
    const code = state.fields?.[name];
    return code ? (f.errors[code] ?? f.errors.invalid) : undefined;
  };
  const inv = (name: string) => ({
    "aria-invalid": Boolean(state.fields?.[name]),
    "aria-describedby": state.fields?.[name] ? `${name}-error` : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {currentTag ? <input type="hidden" name="currentTag" value={currentTag} /> : null}
      {state.error ? <Notice tone="danger">{f.errors[state.error] ?? f.errors.invalid}</Notice> : null}

      <Card className="flex flex-col gap-5">
        <h2 className="font-display text-xl font-bold">{f.identity}</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={f.tag} htmlFor="tag" hint={f.tagHint} error={err("tag")}>
            <Input id="tag" name="tag" required maxLength={20} defaultValue={v.tag} className="font-mono uppercase" {...inv("tag")} />
          </Field>
          <Field label={f.name} htmlFor="name" error={err("name")}>
            <Input id="name" name="name" maxLength={60} defaultValue={v.name} />
          </Field>
          <Field label={f.nameBn} htmlFor="nameBn" error={err("nameBn")}>
            <Input id="nameBn" name="nameBn" lang="bn" maxLength={60} defaultValue={v.nameBn} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <fieldset className="flex flex-col gap-1.5" aria-describedby={state.fields?.sex ? "sex-error" : undefined}>
            <legend className="text-sm font-semibold">{f.sex}</legend>
            <div className="flex gap-2">
              {(["female", "male"] as const).map((s) => (
                <label key={s} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-3 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface">
                  <input type="radio" name="sex" value={s} defaultChecked={(v.sex ?? "female") === s} className="sr-only" />
                  {t.sex[s]}
                </label>
              ))}
            </div>
            {err("sex") ? (
              <p id="sex-error" className="text-sm font-medium text-danger-ink">
                {err("sex")}
              </p>
            ) : null}
          </fieldset>
          <Field label={f.purpose} htmlFor="purpose" error={err("purpose")}>
            <Select id="purpose" name="purpose" defaultValue={v.purpose ?? "dairy"}>
              {(Object.keys(t.purpose) as (keyof AnimalsDict["purpose"])[]).map((p) => (
                <option key={p} value={p}>
                  {t.purpose[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.shed} htmlFor="shedId" error={err("shedId")}>
            <Select id="shedId" name="shedId" defaultValue={v.shedId ?? ""}>
              <option value="">{f.noShed}</option>
              {options.sheds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={f.breed} htmlFor="breedLabel" hint={f.breedHint} error={err("breedLabel")}>
            <Input id="breedLabel" name="breedLabel" list="breed-options" maxLength={60} defaultValue={v.breedLabel} />
          </Field>
          <Field label={f.breedPercent} htmlFor="breedPercent" error={err("breedPercent")}>
            <Input id="breedPercent" name="breedPercent" type="number" inputMode="numeric" min={0} max={100} defaultValue={v.breedPercent} {...inv("breedPercent")} />
          </Field>
          <Field label={f.color} htmlFor="color" error={err("color")}>
            <Input id="color" name="color" maxLength={60} defaultValue={v.color} />
          </Field>
        </div>
        <datalist id="breed-options">
          {options.breeds.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="font-display text-xl font-bold">{f.birth}</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={f.birthDate} htmlFor="birthDate" error={err("birthDate")}>
            <Input id="birthDate" name="birthDate" type="date" max={today} defaultValue={v.birthDate} {...inv("birthDate")} />
          </Field>
          <label className="flex min-h-11 items-center gap-3 self-end">
            <input type="checkbox" name="birthDateEstimated" defaultChecked={v.birthDateEstimated === "true" || v.birthDateEstimated === "on"} className="size-5 accent-[var(--primary)]" />
            <span>{f.estimated}</span>
          </label>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-semibold">{f.origin}</legend>
          <div className="flex max-w-md gap-2">
            {(["born", "purchased"] as const).map((o) => (
              <label key={o} className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-3 text-center has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface">
                <input type="radio" name="origin" value={o} checked={origin === o} onChange={() => setOrigin(o)} className="sr-only" />
                {t.profile.origin[o]}
              </label>
            ))}
          </div>
        </fieldset>
        {origin === "purchased" ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={f.purchaseDate} htmlFor="purchaseDate" error={err("purchaseDate")}>
              <Input id="purchaseDate" name="purchaseDate" type="date" max={today} defaultValue={v.purchaseDate} />
            </Field>
            <Field label={f.purchasePrice} htmlFor="purchasePriceTk" error={err("purchasePriceTk")}>
              <Input id="purchasePriceTk" name="purchasePriceTk" type="number" inputMode="numeric" min={0} defaultValue={v.purchasePriceTk} {...inv("purchasePriceTk")} />
            </Field>
            <Field label={f.purchasedFrom} htmlFor="purchasedFrom" error={err("purchasedFrom")}>
              <Input id="purchasedFrom" name="purchasedFrom" maxLength={120} defaultValue={v.purchasedFrom} />
            </Field>
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="font-display text-xl font-bold">{f.parents}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.damTag} htmlFor="damTag" error={err("damTag")}>
            <Input id="damTag" name="damTag" list="dam-options" maxLength={20} defaultValue={v.damTag} className="font-mono uppercase" {...inv("damTag")} />
          </Field>
          <Field label={f.sireTag} htmlFor="sireTag" error={err("sireTag")}>
            <Input id="sireTag" name="sireTag" list="sire-options" maxLength={20} defaultValue={v.sireTag} className="font-mono" {...inv("sireTag")} />
          </Field>
        </div>
        <datalist id="dam-options">
          {options.dams.map((d) => (
            <option key={d.tag} value={d.tag}>
              {d.name ?? ""}
            </option>
          ))}
        </datalist>
        <datalist id="sire-options">
          {options.bulls.map((b) => (
            <option key={b.tag} value={b.tag}>
              {b.name ?? ""}
            </option>
          ))}
          {options.straws.map((s) => (
            <option key={s.code} value={s.code}>
              {`${t.profile.straw} · ${s.breedLabel ?? ""}`}
            </option>
          ))}
        </datalist>
      </Card>

      <Card>
        <Field label={f.notes} htmlFor="notes">
          <Textarea id="notes" name="notes" maxLength={1000} defaultValue={v.notes} />
        </Field>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? f.saving : f.save}
        </Button>
        <Link href={cancelHref} className={buttonClass("secondary")}>
          {f.cancel}
        </Link>
      </div>
    </form>
  );
}
