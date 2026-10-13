"use client";

import { ChevronsUpDown } from "lucide-react";
import { switchFarmAction } from "@/app/actions/farm";

/** The farm you're working in. With several farms it becomes a picker that switches on change. */
export function FarmSwitcher({
  farms,
  current,
  label,
  district,
}: {
  farms: { id: string; name: string }[];
  current: string;
  label: string;
  district: string;
}) {
  const name = farms.find((f) => f.id === current)?.name ?? "";
  if (farms.length < 2) {
    return (
      <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 leading-tight">
        <p className="truncate text-[15px] font-semibold">{name}</p>
        <p className="truncate text-[13px] text-muted">{district}</p>
      </div>
    );
  }
  return (
    <form action={switchFarmAction} className="relative">
      <label htmlFor="farmId" className="sr-only">
        {label}
      </label>
      <select
        id="farmId"
        name="farmId"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-12 w-full appearance-none truncate rounded-xl bg-surface-2 py-2 pr-9 pl-3.5 text-[15px] font-semibold text-ink"
      >
        {farms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      <noscript>
        <button type="submit">{label}</button>
      </noscript>
    </form>
  );
}
