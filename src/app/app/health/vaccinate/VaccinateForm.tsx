"use client";

import clsx from "clsx";
import { useActionState, useEffect, useMemo, useState } from "react";
import { vaccinateAction } from "@/app/actions/health";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import type { HealthDict } from "@/i18n/health";
import type { VaccineOption } from "@/server/health";

type HerdAnimal = { id: string; tag: string; name: string | null; purpose: string; shed: string | null };

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function VaccinateForm({
  vaccines,
  herd,
  dueBy,
  initialVaccine,
  preselectDue,
  today,
  t,
  locale,
}: {
  vaccines: VaccineOption[];
  herd: HerdAnimal[];
  dueBy: Record<string, string[]>;
  initialVaccine: string;
  preselectDue: boolean;
  today: string;
  t: HealthDict;
  locale: "bn" | "en";
}) {
  const f = t.form;
  const [state, action, pending] = useActionState(vaccinateAction, {});
  const [vaccineId, setVaccineId] = useState(initialVaccine);
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectDue ? (dueBy[initialVaccine] ?? []) : []));
  const [q, setQ] = useState("");
  const vaccine = vaccines.find((v) => v.id === vaccineId);
  const due = useMemo(() => new Set(dueBy[vaccineId] ?? []), [dueBy, vaccineId]);
  const nf = (n: number) => n.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN");
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const err = (k: string) => (state.fields?.[k] ? (t.errors[state.fields[k]!] ?? t.errors.invalid) : undefined);

  useEffect(() => {
    if (state.ok) setSelected(new Set());
  }, [state]);

  const groups = useMemo(() => {
    const m = new Map<string, HerdAnimal[]>();
    const needle = q.trim().toLowerCase();
    for (const a of herd) {
      if (needle && !a.tag.toLowerCase().includes(needle) && !(a.name ?? "").toLowerCase().includes(needle)) continue;
      m.set(a.purpose, [...(m.get(a.purpose) ?? []), a]);
    }
    return [...m.entries()];
  }, [herd, q]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const [okVaccine, okNext] = (state.ok ?? "").split("|");

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]" noValidate>
      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <Card className="flex flex-col gap-4">
          {state.ok ? (
            <Notice tone="ok">
              {fill(f.saved, {
                vaccine: okVaccine ?? "",
                n: nf(state.data?.count ?? 0),
                date: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${okNext}T00:00:00Z`)),
              })}
            </Notice>
          ) : null}
          {state.error && !state.fields ? <Notice tone="danger">{t.errors[state.error] ?? t.errors.invalid}</Notice> : null}
          <Field label={f.vaccine} htmlFor="vaccineId" error={err("vaccineId")}>
            <Select id="vaccineId" name="vaccineId" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>
              {vaccines.map((v) => (
                <option key={v.id} value={v.id}>
                  {locale === "bn" && v.nameBn ? `${v.nameBn} (${v.name})` : v.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={f.date} htmlFor="date" error={err("date")}>
              <Input id="date" name="date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={f.nextDue} htmlFor="nextDueDate" error={err("nextDueDate")}>
              <Input
                id="nextDueDate"
                name="nextDueDate"
                type="date"
                key={`${vaccineId}-${date}`}
                defaultValue={vaccine && date ? addDays(date, vaccine.intervalDays) : ""}
              />
            </Field>
          </div>
          {vaccine ? <p className="-mt-2 text-sm text-muted">{fill(f.nextDueHint, { days: nf(vaccine.intervalDays) })}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={f.batch} htmlFor="batchNo">
              <Input id="batchNo" name="batchNo" maxLength={40} />
            </Field>
            <Field label={f.costPerHead} htmlFor="costPerHeadTk">
              <Input id="costPerHeadTk" name="costPerHeadTk" inputMode="numeric" />
            </Field>
          </div>
          <Field label={f.vet} htmlFor="vetName">
            <Input id="vetName" name="vetName" maxLength={80} />
          </Field>
          {err("animalIds") ? <Notice tone="danger">{err("animalIds")}</Notice> : null}
          <Button type="submit" disabled={pending || selected.size === 0} className="min-h-12">
            {fill(f.save, { n: nf(selected.size) })}
          </Button>
        </Card>
      </div>

      <Card flush className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <p className="mr-auto font-display text-lg font-bold">
            {f.animals} <span className="ml-1 text-[15px] font-medium text-muted">{fill(f.selected, { n: nf(selected.size) })}</span>
          </p>
          {due.size ? (
            <button
              type="button"
              onClick={() => toggle([...due], true)}
              className="min-h-10 rounded-xl bg-danger-bg px-3 text-sm font-semibold text-danger-ink"
            >
              {fill(f.selectDue, { n: nf(due.size) })}
            </button>
          ) : null}
          <button type="button" onClick={() => setSelected(new Set())} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2">
            {f.clear}
          </button>
          <label htmlFor="animal-filter" className="sr-only">
            {f.filter}
          </label>
          <input
            id="animal-filter"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={f.filter}
            className="min-h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-[15px] sm:w-56"
          />
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {groups.map(([purpose, list]) => {
            const allOn = list.every((a) => selected.has(a.id));
            return (
              <fieldset key={purpose} className="border-b border-line last:border-0">
                <legend className="sr-only">{t.groups[purpose] ?? purpose}</legend>
                <div className="sticky top-0 z-[1] flex items-center justify-between bg-surface-2 px-4 py-2">
                  <span className="text-[15px] font-bold capitalize">
                    {t.groups[purpose] ?? purpose} <span className="font-medium text-muted">({nf(list.length)})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(list.map((a) => a.id), !allOn)}
                    className="min-h-9 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-surface"
                  >
                    {allOn ? f.clear : fill(f.selectGroup, { group: t.groups[purpose] ?? purpose })}
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-3 xl:grid-cols-4">
                  {list.map((a) => {
                    const on = selected.has(a.id);
                    return (
                      <li key={a.id}>
                        <label
                          className={clsx(
                            "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm",
                            on ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong",
                          )}
                        >
                          <input
                            type="checkbox"
                            name="animalId"
                            value={a.id}
                            checked={on}
                            onChange={(e) => toggle([a.id], e.target.checked)}
                            className="size-4 accent-[var(--primary)]"
                          />
                          <span className="min-w-0 leading-tight">
                            <span className="block font-semibold tabular">{a.tag}</span>
                            <span className="block truncate text-[12px] text-muted">{a.name ?? a.shed ?? ""}</span>
                          </span>
                          {due.has(a.id) ? <span aria-hidden="true" className="ml-auto size-2 shrink-0 rounded-full bg-danger-ink" /> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>
      </Card>
    </form>
  );
}
