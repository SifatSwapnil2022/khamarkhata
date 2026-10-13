"use client";

import { useId, useState } from "react";

/*
 * Two small, hand-built SVG charts. One series each, so no legend box: the section title names
 * the series. Thin marks, recessive grid, direct labels only where they carry meaning, a hover
 * tooltip on every mark, and a table view for anyone who can't use the picture.
 */

const W = 900;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/** A rounded axis maximum close to the data, on a step of 1, 2, 2.5 or 5 × 10ⁿ. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const rough = v / 4;
  const p = 10 ** Math.floor(Math.log10(rough));
  const n = rough / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  return Math.ceil(v / step) * step;
}

function monthTicks(dates: string[], locale: string) {
  const fmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", timeZone: "UTC" });
  const out: { i: number; label: string }[] = [];
  dates.forEach((d, i) => {
    if (d.endsWith("-01") || i === 0) out.push({ i, label: fmt.format(new Date(`${d}T00:00:00Z`)) });
  });
  return out;
}

type Labels = {
  am: string;
  pm: string;
  total: string;
  withheld: string;
  unit: string;
  tableToggle: string;
  dateCol: string;
};

export function MilkChart({
  data,
  locale,
  labels,
}: {
  data: { date: string; am: number; pm: number; withheld: boolean }[];
  locale: "bn" | "en";
  labels: Labels;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const hatch = useId();
  if (data.length === 0) return null;
  const totals = data.map((d) => d.am + d.pm);
  const yMax = niceMax(Math.max(...totals) * 1.1);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / data.length;
  const bw = Math.max(2, slot - 2); // 2px surface gap between bars
  const y = (v: number) => PAD.top + ih - (v / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];
  const dfmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const n = (v: number) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 1 });
  const h = hover === null ? null : data[hover]!;

  return (
    <div>
      <div className="overflow-x-auto">
      <div className="relative min-w-[560px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={labels.total}>
          <defs>
            <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--danger-bg)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--danger-ink)" strokeWidth="2" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)" fontFamily="var(--font-mono)">
                {n(t)}
              </text>
            </g>
          ))}
          {monthTicks(
            data.map((d) => d.date),
            locale,
          ).map((t) => (
            <text key={t.i} x={PAD.left + t.i * slot} y={H - 8} fontSize="12" fill="var(--muted)">
              {t.label}
            </text>
          ))}
          {data.map((d, i) => {
            const total = d.am + d.pm;
            const x = PAD.left + i * slot + (slot - bw) / 2;
            const top = y(total);
            const hgt = Math.max(0, PAD.top + ih - top);
            const r = Math.min(2, bw / 2, hgt);
            return (
              <path
                key={d.date}
                d={`M${x},${PAD.top + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${PAD.top + ih} Z`}
                fill={d.withheld ? `url(#${hatch})` : "var(--primary)"}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.date}`}
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
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl bg-ink px-3 py-2 text-sm text-surface shadow-lg"
            style={{
              left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`,
              transform: `translateX(${hover > data.length * 0.7 ? "-105%" : "8px"})`,
            }}
          >
            <p className="font-semibold">{dfmt.format(new Date(`${h.date}T00:00:00Z`))}</p>
            <p className="font-mono text-[13px]">
              {labels.am} {n(h.am)} · {labels.pm} {n(h.pm)}
            </p>
            <p className="font-mono text-[13px]">
              {labels.total} {n(h.am + h.pm)} {labels.unit}
            </p>
            {h.withheld ? <p className="mt-1 text-[13px] font-semibold text-danger-bg">{labels.withheld}</p> : null}
          </div>
        ) : null}
      </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary">{labels.tableToggle}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left tabular">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-muted">
                <th className="px-3 py-2 font-semibold">{labels.dateCol}</th>
                <th className="px-3 py-2 text-right font-semibold">{labels.am}</th>
                <th className="px-3 py-2 text-right font-semibold">{labels.pm}</th>
                <th className="px-3 py-2 text-right font-semibold">{labels.total}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-3 py-1.5 font-sans">
                    {dfmt.format(new Date(`${d.date}T00:00:00Z`))} {d.withheld ? `· ${labels.withheld}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">{n(d.am)}</td>
                  <td className="px-3 py-1.5 text-right">{n(d.pm)}</td>
                  <td className="px-3 py-1.5 text-right">{n(d.am + d.pm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function WeightChart({
  points,
  projection,
  target,
  locale,
  labels,
}: {
  points: { date: string; kg: number }[];
  projection: { date: string; kg: number; label: string } | null;
  target: { kg: number; label: string } | null;
  locale: "bn" | "en";
  labels: { unit: string; tableToggle: string; dateCol: string; weightCol: string; projection: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const t = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const x0 = t(points[0]!.date);
  const x1 = Math.max(t(points.at(-1)!.date), projection ? t(projection.date) : 0) || x0 + 86_400_000;
  const allKg = [...points.map((p) => p.kg), projection?.kg ?? 0, target?.kg ?? 0];
  const yMax = niceMax(Math.max(...allKg) * 1.08);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (d: string) => PAD.left + ((t(d) - x0) / Math.max(1, x1 - x0)) * iw;
  const y = (v: number) => PAD.top + ih - (v / yMax) * ih;
  const ticks = [0, yMax / 2, yMax];
  const dfmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
  const n = (v: number) => v.toLocaleString(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 0 });
  const last = points.at(-1)!;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.kg)}`).join(" ");
  const h = hover === null ? null : points[hover]!;

  return (
    <div>
      <div className="overflow-x-auto">
      <div className="relative min-w-[560px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={labels.weightCol}>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tk)} y2={y(tk)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tk) + 4} textAnchor="end" fontSize="12" fill="var(--muted)" fontFamily="var(--font-mono)">
                {n(tk)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 8} fontSize="12" fill="var(--muted)">
            {dfmt.format(new Date(x0))}
          </text>
          <text x={W - PAD.right} y={H - 8} fontSize="12" fill="var(--muted)" textAnchor="end">
            {dfmt.format(new Date(x1))}
          </text>
          {target ? (
            <g>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(target.kg)} y2={y(target.kg)} stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="2 4" />
              <text x={PAD.left + 6} y={y(target.kg) - 6} fontSize="12" fill="var(--ink-2)" fontWeight="600">
                {target.label}
              </text>
            </g>
          ) : null}
          {projection ? (
            <g>
              <line
                x1={x(last.date)}
                y1={y(last.kg)}
                x2={x(projection.date)}
                y2={y(projection.kg)}
                stroke="var(--primary)"
                strokeWidth="2"
                strokeDasharray="6 5"
              />
              <circle cx={x(projection.date)} cy={y(projection.kg)} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2" />
              <text x={x(projection.date) - 8} y={y(projection.kg) - 10} fontSize="12" textAnchor="end" fill="var(--ink)" fontWeight="600">
                {projection.label}
              </text>
            </g>
          ) : null}
          <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <g key={p.date}>
              <circle
                cx={x(p.date)}
                cy={y(p.kg)}
                r={hover === i ? 6 : 4}
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
              <circle
                cx={x(p.date)}
                cy={y(p.kg)}
                r="14"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
        {h && hover !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 rounded-xl bg-ink px-3 py-2 text-sm text-surface shadow-lg"
            style={{
              left: `${(x(h.date) / W) * 100}%`,
              top: `${(y(h.kg) / H) * 100}%`,
              transform: `translate(${x(h.date) > W * 0.7 ? "-110%" : "12px"}, -110%)`,
            }}
          >
            <p className="font-semibold">{dfmt.format(new Date(`${h.date}T00:00:00Z`))}</p>
            <p className="font-mono text-[13px]">
              {n(h.kg)} {labels.unit}
            </p>
          </div>
        ) : null}
      </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary">{labels.tableToggle}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left tabular">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-muted">
                <th className="px-3 py-2 font-semibold">{labels.dateCol}</th>
                <th className="px-3 py-2 text-right font-semibold">{labels.weightCol}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-3 py-1.5 font-sans">{dfmt.format(new Date(`${p.date}T00:00:00Z`))}</td>
                  <td className="px-3 py-1.5 text-right">{n(p.kg)}</td>
                </tr>
              ))}
              {projection ? (
                <tr className="border-t border-line text-muted">
                  <td className="px-3 py-1.5 font-sans">
                    {dfmt.format(new Date(`${projection.date}T00:00:00Z`))} · {labels.projection}
                  </td>
                  <td className="px-3 py-1.5 text-right">{n(projection.kg)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
