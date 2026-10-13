"use client";

import clsx from "clsx";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { breedingEventAction, type BreedingState } from "@/app/actions/breeding";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { AnimalsDict } from "@/i18n/animals";
import type { BreedingDict } from "@/i18n/breeding";
import type { EventType } from "@/server/breeding";

export function BreedingForm({
  t,
  labels,
  today,
  initialTag,
  initialType,
  allowed,
  sires,
}: {
  t: BreedingDict;
  labels: AnimalsDict["profile"];
  today: string;
  initialTag: string;
  initialType: EventType;
  allowed: EventType[];
  sires: { straws: { code: string; breed: string | null }[]; bulls: { code: string; name: string | null; breed: string | null }[] };
}) {
  const f = t.form;
  const [state, action, pending] = useActionState<BreedingState, FormData>(breedingEventAction, {});
  const [type, setType] = useState<EventType>((state.values?.type as EventType) || initialType);
  const [method, setMethod] = useState(state.values?.method || "ai");
  const ref = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const err = (k: string) => (state.fields?.[k] ? (t.errors[state.fields[k]!] ?? t.errors.invalid) : undefined);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  const ok = state.ok;

  return (
    <Card className="max-w-3xl">
      <form ref={ref} action={action} className="flex flex-col gap-5" noValidate>
        {ok ? (
          <Notice tone="ok">
            {ok.calfTag ? f.savedCalf.replace("{calf}", ok.calfTag) : f.saved.replace("{tag}", ok.tag)}{" "}
            <Link href={`/app/animals/${encodeURIComponent(ok.calfTag ?? ok.tag)}`} className="font-semibold text-primary-ink">
              {f.open} →
            </Link>
          </Notice>
        ) : null}
        {state.error === "forbidden" ? <Notice tone="danger">{t.errors.forbidden}</Notice> : null}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{f.type}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allowed.map((k) => (
              <label
                key={k}
                className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong px-3 text-center text-[15px] font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:checked]:text-primary-ink"
              >
                <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
                {labels.events[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.tag} htmlFor="tag" error={err("tag")}>
            <Input id="tag" name="tag" required defaultValue={v.tag ?? initialTag} className="uppercase" aria-invalid={Boolean(err("tag"))} />
          </Field>
          <Field label={f.date} htmlFor="date" error={err("date")}>
            <Input id="date" name="date" type="date" max={today} defaultValue={v.date || today} aria-invalid={Boolean(err("date"))} />
          </Field>
        </div>

        {type === "service" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">{f.method}</legend>
              <div className="flex rounded-xl bg-surface-2 p-1">
                {(["ai", "natural"] as const).map((m) => (
                  <label
                    key={m}
                    className={clsx(
                      "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-[15px] font-semibold",
                      method === m ? "bg-surface text-ink shadow-sm" : "text-muted",
                    )}
                  >
                    <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                    {labels.method[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={f.sire} htmlFor="sire" hint={f.sireHint} error={err("sire")}>
              <Input id="sire" name="sire" list="sire-list" defaultValue={v.sire} className="uppercase" aria-invalid={Boolean(err("sire"))} />
              <datalist id="sire-list">
                {(method === "ai" ? sires.straws : sires.bulls).map((s) => (
                  <option key={s.code} value={s.code}>
                    {[("name" in s ? s.name : null) ?? null, s.breed].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </datalist>
            </Field>
            <div className="sm:col-span-2">
              <Field label={f.technician} htmlFor="technician">
                <Input id="technician" name="technician" defaultValue={v.technician} maxLength={80} />
              </Field>
            </div>
          </div>
        ) : null}

        {type === "pregnancy_check" ? (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{f.pd}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["positive", "negative", "uncertain"] as const).map((r) => (
                <label
                  key={r}
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line-strong px-3 text-[15px] font-medium has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:checked]:text-primary-ink"
                >
                  <input type="radio" name="pdResult" value={r} defaultChecked={v.pdResult === r} className="sr-only" />
                  {labels.pd[r]}
                </label>
              ))}
            </div>
            {err("pdResult") ? <p className="mt-1.5 text-sm font-medium text-danger-ink">{err("pdResult")}</p> : null}
          </fieldset>
        ) : null}

        {type === "calving" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={f.calfTag} htmlFor="calfTag" error={err("calfTag")}>
              <Input id="calfTag" name="calfTag" defaultValue={v.calfTag} className="uppercase" aria-invalid={Boolean(err("calfTag"))} />
            </Field>
            <Field label={f.calfSex} htmlFor="calfSex" error={err("calfSex")}>
              <Select id="calfSex" name="calfSex" defaultValue={v.calfSex ?? ""} aria-invalid={Boolean(err("calfSex"))}>
                <option value="" disabled>
                  —
                </option>
                <option value="female">{f.calfSexOpts.female}</option>
                <option value="male">{f.calfSexOpts.male}</option>
              </Select>
            </Field>
            <Field label={f.calfName} htmlFor="calfName">
              <Input id="calfName" name="calfName" defaultValue={v.calfName} maxLength={60} />
            </Field>
            <Field label={f.ease} htmlFor="calvingEase">
              <Select id="calvingEase" name="calvingEase" defaultValue={v.calvingEase || "normal"}>
                {(Object.keys(f.easeOpts) as (keyof typeof f.easeOpts)[]).map((k) => (
                  <option key={k} value={k}>
                    {f.easeOpts[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <Field label={f.notes} htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={v.notes} maxLength={500} />
        </Field>

        {state.error === "related" && state.relations?.length ? (
          <div className="rounded-xl bg-warn-bg p-4 text-warn-ink">
            <p className="font-semibold">{f.related.replace("{list}", state.relations.map((r) => f.relations[r] ?? r).join(", "))}</p>
            <label className="mt-3 flex min-h-11 items-center gap-2 font-semibold">
              <input type="checkbox" name="acceptRelation" value="yes" className="size-5 accent-[var(--warn-ink)]" />
              {f.relatedConfirm}
            </label>
          </div>
        ) : null}

        <div>
          <Button type="submit" disabled={pending} className="min-h-12 px-8">
            {f.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}
