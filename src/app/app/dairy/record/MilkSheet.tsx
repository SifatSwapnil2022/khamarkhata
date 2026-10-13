"use client";

import clsx from "clsx";
import { CloudOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveMilkAction } from "@/app/actions/dairy";
import { Button, EarTag, Notice } from "@/components/ui";
import type { DairyDict } from "@/i18n/dairy";
import type { MilkInput, MilkSession, MilkSheetRow } from "@/server/dairy";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = (s: string) => s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c))).replace(",", ".");
const parse = (s: string): number | null => {
  const v = toAscii(s.trim());
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
};

type Queued = { input: MilkInput; at: number };
const queueKey = (farmId: string) => `kk_milk_queue:${farmId}`;

function readQueue(farmId: string): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(farmId)) ?? "[]") as Queued[];
  } catch {
    return [];
  }
}
function writeQueue(farmId: string, q: Queued[]) {
  try {
    if (q.length) localStorage.setItem(queueKey(farmId), JSON.stringify(q));
    else localStorage.removeItem(queueKey(farmId));
  } catch {
    /* storage unavailable: nothing more we can do offline */
  }
}

/**
 * The milking sheet. Built for a phone in the shed: one big number field per cow, Enter jumps to
 * the next cow, Bangla digits work, and a running total stays in view. If the network drops, the
 * milking is kept on the phone and sent when it's back (saving is idempotent, so replays are safe).
 */
export function MilkSheet({
  farmId,
  date,
  today,
  session,
  rows,
  locale,
  t,
  L,
}: {
  farmId: string;
  date: string;
  today: string;
  session: MilkSession;
  rows: MilkSheetRow[];
  locale: "bn" | "en";
  t: DairyDict;
  L: string;
}) {
  const s = t.sheet;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.litres === null ? "" : String(r.litres)])),
  );
  const initial = useRef(values);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [queued, setQueued] = useState(0);
  const [pending, start] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const nf = useCallback(
    (v: number, d = 1) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: d }),
    [locale],
  );
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const dateLabel = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );

  const milking = rows.filter((r) => r.milking);
  const dry = rows.filter((r) => !r.milking);
  const groups = useMemo(() => {
    const m = new Map<string, MilkSheetRow[]>();
    for (const r of milking) {
      const k = r.shed ?? "—";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [milking]);
  const order = [...milking, ...dry];

  const parsed = Object.fromEntries(order.map((r) => [r.id, parse(values[r.id] ?? "")]));
  const total = Object.values(parsed).reduce<number>((sum, v) => sum + (v && v > 0 ? v : 0), 0);
  const entered = Object.values(parsed).filter((v) => v !== null && v > 0).length;
  const invalid = order.filter((r) => {
    const v = parsed[r.id];
    return v !== null && v !== undefined && (Number.isNaN(v) || v < 0 || v > 60);
  });
  const changed = order.filter((r) => (values[r.id] ?? "") !== (initial.current[r.id] ?? ""));

  const flush = useCallback(async () => {
    const q = readQueue(farmId);
    if (!q.length || !navigator.onLine) {
      setQueued(q.length);
      return;
    }
    const left: Queued[] = [];
    for (const item of q) {
      try {
        const res = await saveMilkAction(item.input);
        if (!res.ok && res.error !== "invalid" && res.error !== "future") left.push(item);
      } catch {
        left.push(item);
      }
    }
    writeQueue(farmId, left);
    setQueued(left.length);
    if (left.length < q.length) {
      setStatus({ tone: "ok", text: s.sent });
      router.refresh();
    }
  }, [farmId, router, s.sent]);

  useEffect(() => {
    void flush();
    const on = () => void flush();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [flush]);

  // Warn before leaving with unsaved numbers.
  useEffect(() => {
    if (!changed.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [changed.length]);

  const go = (patch: { date?: string; session?: MilkSession }) => {
    const p = new URLSearchParams({ date: patch.date ?? date, session: patch.session ?? session });
    router.push(`/app/dairy/record?${p.toString()}`);
  };

  const save = () => {
    if (invalid.length) {
      setStatus({ tone: "danger", text: s.tooHigh });
      inputs.current[order.indexOf(invalid[0]!)]?.focus();
      return;
    }
    const input: MilkInput = {
      date,
      session,
      entries: changed.map((r) => ({ animalId: r.id, litres: parsed[r.id] ?? null })),
    };
    start(async () => {
      const queue = () => {
        writeQueue(farmId, [...readQueue(farmId), { input, at: Date.now() }]);
        setQueued(readQueue(farmId).length);
        initial.current = values;
        setStatus({ tone: "warn", text: s.queued });
      };
      if (!navigator.onLine) return queue();
      try {
        const res = await saveMilkAction(input);
        if (!res.ok) {
          setStatus({ tone: "danger", text: res.error === "future" ? s.future : s.failed });
          return;
        }
        initial.current = values;
        const text = fill(s.saved, { n: nf(entered, 0), session: t.sessions[session], date: dateLabel });
        setStatus({ tone: "ok", text: res.withheld ? `${text} ${fill(s.savedWithheld, { n: nf(res.withheld, 0) })}` : text });
        router.refresh();
      } catch {
        queue();
      }
    });
  };

  const row = (r: MilkSheetRow) => {
    const idx = order.indexOf(r);
    const v = parsed[r.id];
    const bad = v !== null && v !== undefined && (Number.isNaN(v) || v < 0 || v > 60);
    const high = !bad && v && r.usual && v > r.usual * 1.6 && v - r.usual > 2;
    const name = (locale === "bn" ? r.nameBn ?? r.name : r.name ?? r.nameBn) ?? "";
    return (
      <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-0">
        <div className="min-w-0 flex-1">
          <label htmlFor={`m-${r.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <EarTag tag={r.tag} />
            <span className="truncate font-semibold">{name}</span>
          </label>
          <p className="mt-0.5 text-[13px] text-muted">
            {r.usual !== null ? fill(s.usual, { n: nf(r.usual) }) : null}
            {r.withdrawalUntil ? (
              <span className="mt-0.5 block font-semibold text-danger-ink">
                {fill(s.withdrawal, {
                  date: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
                    new Date(`${r.withdrawalUntil}T00:00:00Z`),
                  ),
                })}
              </span>
            ) : null}
            {high ? <span className="mt-0.5 block font-semibold text-warn-ink">{s.unusual}</span> : null}
          </p>
        </div>
        <div className="relative w-28 shrink-0">
          <input
            id={`m-${r.id}`}
            ref={(el) => {
              inputs.current[idx] = el;
            }}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint={idx === order.length - 1 ? "done" : "next"}
            value={values[r.id] ?? ""}
            placeholder={r.usual !== null ? nf(r.usual) : ""}
            aria-invalid={bad || undefined}
            onChange={(e) => setValues((prev) => ({ ...prev, [r.id]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                inputs.current[idx + 1]?.focus();
              }
            }}
            className={clsx(
              "min-h-12 w-full rounded-xl border bg-surface pr-9 pl-3 text-right text-lg font-semibold tabular placeholder:font-normal placeholder:text-line-strong focus:border-primary",
              bad ? "border-danger-ink" : r.withdrawalUntil ? "border-danger-ink/40 bg-danger-bg/40" : "border-line-strong",
            )}
          />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">
            {L}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Date and milking */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-1">
          <label htmlFor="milk-date" className="text-sm font-semibold">
            {s.date}
          </label>
          <input
            id="milk-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="min-h-11 rounded-xl border border-line-strong bg-surface px-3 text-[16px]"
          />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">{s.session}</legend>
          <div className="flex rounded-xl bg-surface-2 p-1">
            {(["am", "pm"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={session === k}
                onClick={() => session !== k && go({ session: k })}
                className={clsx(
                  "min-h-10 rounded-lg px-5 text-[15px] font-semibold",
                  session === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {t.sessions[k]}
              </button>
            ))}
          </div>
        </fieldset>
        {queued ? (
          <div className="ml-auto flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-ink">
            <CloudOff aria-hidden="true" className="size-4" />
            {fill(s.queuedCount, { n: nf(queued, 0) })}
            <button type="button" onClick={() => void flush()} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 underline-offset-2 hover:underline">
              <RefreshCw aria-hidden="true" className="size-3.5" /> {s.sendNow}
            </button>
          </div>
        ) : null}
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      {rows.length === 0 ? (
        <Notice tone="warn">{s.noCows}</Notice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-5"
        >
          {groups.map(([shed, list]) => (
            <section key={shed} aria-label={shed} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
              <h2 className="flex items-baseline justify-between bg-surface-2/70 px-4 py-2.5 text-[15px] font-bold">
                {shed}
                <span className="text-sm font-medium text-muted tabular">
                  {nf(list.reduce((sum, r) => sum + (parsed[r.id] && parsed[r.id]! > 0 ? parsed[r.id]! : 0), 0))} {L}
                </span>
              </h2>
              <ul>{list.map(row)}</ul>
            </section>
          ))}

          {dry.length ? (
            <details className="overflow-hidden rounded-2xl border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between px-4 font-semibold">
                {fill(s.dryCows, { n: nf(dry.length, 0) })}
                <span className="text-sm font-normal text-muted">{s.dryHint}</span>
              </summary>
              <ul>{dry.map(row)}</ul>
            </details>
          ) : null}

          {/* Running total, always in reach of the thumb */}
          <div className="sticky bottom-[calc(var(--tabbar)+0.75rem)] z-10 flex items-center justify-between gap-4 rounded-2xl bg-deep px-5 py-3 text-white shadow-[var(--shadow-pop)] lg:bottom-4">
            <div className="leading-tight">
              <p className="text-sm text-deep-ink">
                {t.sessions[session]} · {dateLabel} · {fill(s.cowsEntered, { n: nf(entered, 0), m: nf(milking.length, 0) })}
              </p>
              <p className="font-display text-2xl font-extrabold tabular">
                {nf(total)} <span className="text-base font-medium text-deep-ink">{L}</span>
                {changed.length ? <span className="ml-2 align-middle text-[13px] font-semibold text-accent">● {s.unsaved}</span> : null}
              </p>
            </div>
            <Button type="submit" variant="light" disabled={pending || changed.length === 0}>
              {pending ? s.saving : s.save}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
