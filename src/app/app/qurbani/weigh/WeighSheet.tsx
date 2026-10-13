"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveWeighInsAction } from "@/app/actions/qurbani";
import { Button, EarTag, Notice } from "@/components/ui";
import type { QurbaniDict } from "@/i18n/qurbani";
import type { WeighGroup, WeighInput } from "@/server/qurbani";

type Row = {
  id: string;
  tag: string;
  name: string | null;
  shed: string | null;
  last: { kg: number; date: string } | null;
  today: { kg: number; method: "scale" | "tape"; girth: number | null; length: number | null } | null;
};
type Entry = { method: "scale" | "tape"; kg: string; girth: string; length: string };

const BN = "০১২৩৪৫৬৭৮৯";
const num = (s: string) => {
  const v = s.trim().replace(/[০-৯]/g, (c) => String(BN.indexOf(c)));
  return v === "" ? null : Number(v);
};
/** Schaeffer's formula in metric; the server applies the same one. */
const tapeKg = (g: number, l: number) => Math.round(((g * g * l) / 10_838) * 2) / 2;

export function WeighSheet({
  rows,
  group,
  date,
  today,
  t,
  locale,
}: {
  rows: Row[];
  group: WeighGroup;
  date: string;
  today: string;
  t: QurbaniDict;
  locale: "bn" | "en";
}) {
  const s = t.sheet;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [bad, setBad] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          method: r.today?.method ?? "scale",
          kg: r.today?.method === "scale" ? String(r.today.kg) : "",
          girth: r.today?.girth ? String(r.today.girth) : "",
          length: r.today?.length ? String(r.today.length) : "",
        },
      ]),
    ),
  );
  const nf = (v: number, d = 0) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: d });
  const short = (iso: string) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

  const weightOf = (e: Entry) => {
    if (e.method === "scale") return num(e.kg);
    const g = num(e.girth);
    const l = num(e.length);
    return g && l ? tapeKg(g, l) : null;
  };
  const filled = rows.filter((r) => weightOf(entries[r.id]!) !== null);

  const set = (id: string, patch: Partial<Entry>) => setEntries((p) => ({ ...p, [id]: { ...p[id]!, ...patch } }));
  const go = (patch: { group?: string; date?: string }) =>
    router.push(`/app/qurbani/weigh?${new URLSearchParams({ group: patch.group ?? group, date: patch.date ?? date }).toString()}`);

  const save = () => {
    const input: WeighInput = {
      date,
      entries: filled.map((r) => {
        const e = entries[r.id]!;
        return e.method === "scale"
          ? { animalId: r.id, method: "scale" as const, kg: num(e.kg) ?? undefined }
          : { animalId: r.id, method: "tape" as const, girthCm: num(e.girth) ?? undefined, lengthCm: num(e.length) ?? undefined };
      }),
    };
    start(async () => {
      const res = await saveWeighInsAction(input);
      if (res.ok) {
        setBad(new Set());
        setStatus({ tone: "ok", text: fill(s.saved, { n: nf(res.count) }) });
        router.refresh();
      } else {
        setBad(new Set(res.bad));
        setStatus({ tone: "danger", text: res.bad.length ? s.failed : (t.errors[res.error] ?? t.errors.invalid ?? "") });
      }
    });
  };

  const field = "min-h-11 w-full rounded-xl border bg-surface px-3 text-right text-[16px] font-semibold tabular focus:border-primary";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-1">
          <label htmlFor="w-date" className="text-sm font-semibold">
            {s.date}
          </label>
          <input
            id="w-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="w-group" className="text-sm font-semibold">
            {s.group}
          </label>
          <select
            id="w-group"
            value={group}
            onChange={(e) => go({ group: e.target.value })}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px]"
          >
            {(Object.keys(s.groups) as WeighGroup[]).map((g) => (
              <option key={g} value={g}>
                {s.groups[g]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      {rows.length === 0 ? (
        <Notice tone="warn">{s.none}</Notice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-4"
        >
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
            {rows.map((r) => {
              const e = entries[r.id]!;
              const w = weightOf(e);
              const diff = w !== null && r.last ? w - r.last.kg : null;
              return (
                <li
                  key={r.id}
                  className={clsx(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 first:border-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,16rem)_5.5rem]",
                    bad.has(r.id) && "bg-danger-bg/50",
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <EarTag tag={r.tag} />
                      <span className="truncate font-semibold">{r.name ?? r.shed ?? ""}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted">{r.last ? fill(s.last, { kg: nf(r.last.kg), date: short(r.last.date) }) : "—"}</p>
                  </div>
                  <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label={`${s.method} ${r.tag}`}>
                    {(["scale", "tape"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={e.method === m}
                        onClick={() => set(r.id, { method: m })}
                        className={clsx("min-h-9 rounded-md px-3 text-sm font-semibold", e.method === m ? "bg-surface text-ink shadow-sm" : "text-muted")}
                      >
                        {s[m]}
                      </button>
                    ))}
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    {e.method === "scale" ? (
                      <label className="relative block">
                        <span className="sr-only">
                          {r.tag} {s.kg}
                        </span>
                        <input
                          inputMode="decimal"
                          value={e.kg}
                          onChange={(ev) => set(r.id, { kg: ev.target.value })}
                          placeholder={r.last ? nf(r.last.kg) : ""}
                          className={clsx(field, "pr-12 placeholder:font-normal placeholder:text-line-strong", bad.has(r.id) ? "border-danger-ink" : "border-line-strong")}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">{s.kg}</span>
                      </label>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="mb-0.5 block text-[12px] text-muted">{s.girth}</span>
                          <input inputMode="decimal" value={e.girth} onChange={(ev) => set(r.id, { girth: ev.target.value })} className={clsx(field, "border-line-strong")} />
                        </label>
                        <label>
                          <span className="mb-0.5 block text-[12px] text-muted">{s.length}</span>
                          <input inputMode="decimal" value={e.length} onChange={(ev) => set(r.id, { length: ev.target.value })} className={clsx(field, "border-line-strong")} />
                        </label>
                      </div>
                    )}
                  </div>
                  <p className="col-span-2 text-right text-sm tabular sm:col-span-1" aria-live="polite">
                    {w !== null ? (
                      <>
                        <span className="font-display text-lg font-extrabold">{nf(w, 1)}</span> {s.kg}
                        {diff !== null ? (
                          <span className={clsx("block text-[13px] font-semibold", diff < 0 ? "text-danger-ink" : "text-primary")}>
                            {fill(s.gain, { sign: diff >= 0 ? "+" : "−", kg: nf(Math.abs(diff), 1) })}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-[calc(var(--tabbar)+0.75rem)] z-10 flex items-center justify-between gap-4 rounded-2xl bg-deep px-5 py-3 text-white shadow-[var(--shadow-pop)] lg:bottom-4">
            <p className="font-semibold">{fill(s.entered, { n: nf(filled.length) })}</p>
            <Button type="submit" variant="light" disabled={pending || filled.length === 0}>
              {pending ? s.saving : s.save}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
