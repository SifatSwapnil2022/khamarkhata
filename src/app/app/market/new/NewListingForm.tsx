"use client";

import { useActionState, useMemo, useState } from "react";
import { createListingAction } from "@/app/actions/market";
import { Button, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import type { MarketDict } from "@/i18n/market";
import { formatter } from "@/lib/format";

export type Candidate = {
  id: string;
  tag: string;
  name: string | null;
  breed: string | null;
  category: "qurbani" | "milking_cow" | "heifer" | "breeding_bull" | "other";
  kg: number | null;
  milk: number | null;
};

const ORDER: Candidate["category"][] = ["qurbani", "milking_cow", "heifer", "breeding_bull", "other"];

export function NewListingForm({
  t,
  locale,
  candidates,
  preselect,
  kg,
  litres,
}: {
  t: MarketDict;
  locale: "bn" | "en";
  candidates: Candidate[];
  preselect?: string;
  kg: string;
  litres: string;
}) {
  const fmt = useMemo(() => formatter(locale), [locale]);
  const [state, action, pending] = useActionState(createListingAction, {});
  const v = state.values ?? {};
  const [animalId, setAnimalId] = useState(v.animalId || candidates.find((c) => c.tag === preselect)?.id || "");
  const picked = candidates.find((c) => c.id === animalId);

  // A title buyers can scan: who it is, the breed, and the one number they look for.
  const suggestion = useMemo(() => {
    if (!picked) return "";
    const who = picked.name ?? picked.tag;
    const figure =
      picked.category === "milking_cow" && picked.milk
        ? litres.replace("{n}", fmt.n(picked.milk, 1))
        : picked.kg
          ? kg.replace("{n}", fmt.n(Math.round(picked.kg)))
          : null;
    return [who, [picked.breed, figure].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
  }, [picked, kg, litres, fmt]);
  const [title, setTitle] = useState(v.title ?? "");
  const [edited, setEdited] = useState(Boolean(v.title));

  const err = (k: string) => (state.fields?.[k] ? (t.listErrors[state.fields[k]!] ?? t.listErrors.invalid) : undefined);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && !state.fields ? <Notice tone="danger">{t.listErrors[state.error] ?? t.listErrors.invalid}</Notice> : null}

      <Field label={t.form.animal} htmlFor="animalId" hint={t.form.animalHint} error={err("animalId")}>
        <Select
          id="animalId"
          name="animalId"
          value={animalId}
          onChange={(e) => {
            setAnimalId(e.target.value);
            if (!edited) setTitle("");
          }}
          aria-invalid={Boolean(err("animalId"))}
        >
          <option value="" disabled>
            —
          </option>
          {ORDER.map((cat) => {
            const group = candidates.filter((c) => c.category === cat);
            return group.length ? (
              <optgroup key={cat} label={t.categories[cat]}>
                {group.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.tag, c.name, c.breed].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </Select>
      </Field>
      <input type="hidden" name="category" value={picked?.category ?? ""} />

      <Field label={t.form.title} htmlFor="title" hint={t.form.titleHint} error={err("title")}>
        <Input
          id="title"
          name="title"
          maxLength={120}
          value={edited ? title : title || suggestion}
          onChange={(e) => {
            setEdited(true);
            setTitle(e.target.value);
          }}
          aria-invalid={Boolean(err("title"))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.form.price} htmlFor="priceTk" error={err("priceTk")}>
          <Input id="priceTk" name="priceTk" inputMode="numeric" defaultValue={v.priceTk} aria-invalid={Boolean(err("priceTk"))} />
        </Field>
        <label className="flex min-h-11 items-center gap-2.5 self-end font-semibold">
          <input type="checkbox" name="negotiable" defaultChecked={v.negotiable ? v.negotiable === "on" : true} className="size-5 accent-[var(--primary)]" />
          {t.form.negotiable}
        </label>
      </div>

      <Field label={t.form.description} htmlFor="description" hint={t.form.descriptionHint}>
        <Textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={v.description} />
      </Field>

      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="publish" defaultChecked={v.publish ? v.publish === "on" : true} className="mt-0.5 size-5 accent-[var(--primary)]" />
        <span>
          <span className="block font-semibold">{t.form.publishNow}</span>
          <span className="block text-sm text-muted">{t.form.publishHint}</span>
        </span>
      </label>

      <Button type="submit" disabled={pending || !candidates.length} className="self-start">
        {t.form.save}
      </Button>
    </form>
  );
}
