"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";
import type { AnimalsDict } from "@/i18n/animals";

/**
 * Filters live in the URL so every view can be bookmarked or shared.
 * Works without JavaScript too: it's a plain GET form; scripts only make it apply on change.
 */
export function FilterBar({
  t,
  breeds,
  showMilkSort,
  showWeightSort,
}: {
  t: AnimalsDict;
  breeds: string[];
  showMilkSort: boolean;
  showWeightSort: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const apply = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const next = new URLSearchParams();
    const group = params.get("group");
    const view = params.get("view");
    if (group) next.set("group", group);
    if (view) next.set("view", view);
    for (const key of ["q", "status", "breed", "sort"]) {
      const v = String(data.get(key) ?? "").trim();
      if (v) next.set(key, v);
    }
    start(() => router.push(`${pathname}?${next.toString()}`));
  };

  const hasFilters = ["q", "status", "breed", "sort"].some((k) => params.get(k));

  return (
    <form
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) => {
        if ((e.target as HTMLElement).tagName === "SELECT") apply(e.currentTarget);
      }}
      className="flex flex-wrap items-end gap-3"
      aria-busy={pending}
    >
      {params.get("group") ? <input type="hidden" name="group" value={params.get("group")!} /> : null}
      <div className="flex min-w-0 flex-[2_1_240px] flex-col gap-1">
        <label htmlFor="q" className="text-sm font-semibold">
          {t.searchLabel}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder={t.search}
          className="min-h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-[15px] placeholder:text-muted/70"
        />
      </div>
      <div className="flex flex-[1_1_150px] flex-col gap-1">
        <label htmlFor="status" className="text-sm font-semibold">
          {t.status}
        </label>
        <Select id="status" name="status" defaultValue={params.get("status") ?? ""} className="rounded-full">
          <option value="">{t.anyStatus}</option>
          {(Object.keys(t.statuses) as (keyof AnimalsDict["statuses"])[]).map((s) => (
            <option key={s} value={s}>
              {t.statuses[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-[1_1_150px] flex-col gap-1">
        <label htmlFor="breed" className="text-sm font-semibold">
          {t.breed}
        </label>
        <Select id="breed" name="breed" defaultValue={params.get("breed") ?? ""} className="rounded-full">
          <option value="">{t.anyBreed}</option>
          {breeds.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-[1_1_130px] flex-col gap-1">
        <label htmlFor="sort" className="text-sm font-semibold">
          {t.sort}
        </label>
        <Select id="sort" name="sort" defaultValue={params.get("sort") ?? "tag"} className="rounded-full">
          <option value="tag">{t.sorts.tag}</option>
          {showMilkSort ? <option value="milk">{t.sorts.milk}</option> : null}
          {showWeightSort ? <option value="weight">{t.sorts.weight}</option> : null}
          <option value="age">{t.sorts.age}</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-surface hover:opacity-90"
        >
          {t.apply}
        </button>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              if (params.get("group")) next.set("group", params.get("group")!);
              if (params.get("view")) next.set("view", params.get("view")!);
              start(() => router.push(`${pathname}?${next.toString()}`));
            }}
            className="min-h-11 rounded-full px-3 text-[15px] font-semibold text-ink-2 underline-offset-4 hover:underline"
          >
            {t.clear}
          </button>
        ) : null}
      </div>
    </form>
  );
}
