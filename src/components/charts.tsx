"use client";

import clsx from "clsx";
import Link from "next/link";
import { useId, useState } from "react";

/*
 * Shared hand-built SVG charts for the section dashboards and reports.
 * One series per chart (the heading names it), a recessive grid, a hover tooltip on every mark,
 * and a table view behind a toggle for anyone who can't use the picture.
 */

const W = 900;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 48 };

export function niceMax(v: number) {
  if (v <= 0) return 1;
  const rough = v / 4;
  const p = 10 ** Math.floor(Math.log10(rough));
  const n = rough / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  return Math.ceil(v / step) * step;
}

export type BarDatum = {
  /** Shown under the bar and in the table. */
  label: string;
  /** Longer label for the tooltip and table, if different. */
  title?: string;
  value: number;
  /** Draw this bar hatched (e.g. a forecast or an incomplete month). */
  flagged?: boolean;
  /** Part of the value to draw hatched on top of the bar (e.g. milk withheld from sale). */
  part?: number;
  /** Extra line in the tooltip. */
  note?: string;
  /** Only every n-th label is drawn when bars are dense; mark the ones that should be. */
  tick?: boolean;
};

export function BarChart({
  data,
  locale,
  unit,
  prefix = "",
  decimals = 0,
  name,
  flagLabel,
  tableToggle,
  colLabel,
  height = H,
  tone = "primary",
}: {
  data: BarDatum[];
  locale: "bn" | "en";
  unit?: string;
  prefix?: string;
  decimals?: number;
  name: string;
  flagLabel?: string;
  tableToggle: string;
  colLabel: string;
  height?: number;
  tone?: "primary" | "fresh" | "deep";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const hatch = useId();
  if (data.length === 0) return null;
  const yMax = niceMax(Math.max(...data.map((d) => d.value)) * 1.08);
  const iw = W - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const slot = iw / data.length;
  const bw = Math.max(2, Math.min(slot - 2, 56));
  const y = (v: number) => PAD.top + ih - (v / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];
  const nf = (v: number, d = decimals) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: d });
  const fmt = (v: number) => `${prefix}${nf(v)}${unit ? ` ${unit}` : ""}`;
  const dense = data.length > 16;
  const fill = `var(--${tone})`;
  const h = hover === null ? null : data[hover]!;

  return (
    <div>
      <div className="overflow-x-auto">
        <div className={clsx("relative", dense && "min-w-[560px]")}>
          <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full" role="img" aria-label={name}>
            <defs>
              <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--primary-soft)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={fill} strokeWidth="2" />
              </pattern>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
                  {prefix}
                  {nf(t, t < 10 ? 1 : 0)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              !dense || d.tick ? (
                <text
                  key={`t-${i}`}
                  x={PAD.left + i * slot + slot / 2}
                  y={height - 8}
                  fontSize="12"
                  textAnchor={dense ? "start" : "middle"}
                  fill="var(--muted)"
                >
                  {d.label}
                </text>
              ) : null,
            )}
            {data.map((d, i) => {
              const x = PAD.left + i * slot + (slot - bw) / 2;
              const top = y(d.value);
              const hgt = Math.max(0, PAD.top + ih - top);
              const r = Math.min(4, bw / 2, hgt);
              const partTop = d.part ? y(d.value - d.part) : null;
              return (
                <g key={i} opacity={hover === null || hover === i ? 1 : 0.45}>
                  <path
                    d={`M${x},${PAD.top + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${PAD.top + ih} Z`}
                    fill={d.flagged ? `url(#${hatch})` : fill}
                  />
                  {partTop !== null ? (
                    <rect x={x} y={top} width={bw} height={Math.max(1.5, partTop - top)} fill={`url(#${hatch})`} />
                  ) : null}
                </g>
              );
            })}
            {data.map((_, i) => (
              <rect
                key={`hit-${i}`}
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {h && hover !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-xl bg-ink px-3 py-2 text-sm text-surface shadow-lg"
              style={{
                left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`,
                transform: `translateX(${hover > data.length * 0.65 ? "-105%" : "8px"})`,
              }}
            >
              <p className="font-semibold">{h.title ?? h.label}</p>
              <p className="tabular">{fmt(h.value)}</p>
              {h.note ? <p className="text-[13px] opacity-80">{h.note}</p> : null}
              {(h.flagged || h.part) && flagLabel ? (
                <p className="mt-1 text-[13px] font-semibold text-accent">
                  {flagLabel}
                  {h.part ? ` · ${prefix}${nf(h.part, 1)}${unit ? ` ${unit}` : ""}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary">{tableToggle}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left tabular">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-muted">
                <th className="px-3 py-2 font-semibold">{colLabel}</th>
                <th className="px-3 py-2 text-right font-semibold">{name}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">
                    {d.title ?? d.label}
                    {(d.flagged || d.part) && flagLabel ? <span className="text-muted"> · {flagLabel}{d.part ? ` ${nf(d.part, 1)}` : ""}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Horizontal bars for a ranked breakdown (categories, cows, buyers). Plain HTML, so it reads as a list. */
export function RankBars({
  rows,
  locale,
  unit,
  prefix = "",
  decimals = 0,
}: {
  rows: { label: string; sub?: string; value: number; href?: string; tone?: "primary" | "warn" | "danger" }[];
  locale: "bn" | "en";
  unit?: string;
  prefix?: string;
  decimals?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const nf = (v: number) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: decimals });
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="min-w-0 truncate text-[15px] font-medium">
            {r.href ? (
              <Link href={r.href} className="text-ink no-underline hover:text-primary">
                {r.label}
              </Link>
            ) : (
              r.label
            )}
            {r.sub ? <span className="ml-1.5 text-sm font-normal text-muted">{r.sub}</span> : null}
          </span>
          <span className="text-[15px] font-semibold tabular">
            {prefix}
            {nf(r.value)}
            {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
          </span>
          <span className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <span
              className={clsx(
                "block h-full rounded-full",
                r.tone === "warn" ? "bg-[#f38744]" : r.tone === "danger" ? "bg-danger-ink/80" : "bg-primary",
              )}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
