import type { Segment } from "@/db/schema";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/en";
import { DISTRICTS } from "@/lib/bd";
import { Field, Input, Select } from "./ui";

const SEGMENTS: Segment[] = ["dairy", "breeding", "qurbani"];

/** Farm name, location and segments — shared by onboarding and settings. */
export function FarmFields({
  t,
  locale,
  errors = {},
  defaults,
}: {
  t: Dictionary["onboarding"];
  locale: Locale;
  errors?: Record<string, string>;
  defaults?: { name?: string; district?: string; upazila?: string | null; segments?: Segment[] };
}) {
  const divisions = [...new Set(DISTRICTS.map((d) => d.division))];
  return (
    <>
      <Field label={t.farmName} htmlFor="name" error={errors.name ? t.errors.invalid : undefined}>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t.farmNamePlaceholder}
          defaultValue={defaults?.name}
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t.district} htmlFor="district" error={errors.district ? t.chooseDistrict : undefined}>
          <Select id="district" name="district" required defaultValue={defaults?.district ?? ""} aria-invalid={Boolean(errors.district)}>
            <option value="" disabled>
              {t.chooseDistrict}
            </option>
            {divisions.map((div) => (
              <optgroup key={div} label={div}>
                {DISTRICTS.filter((d) => d.division === div).map((d) => (
                  <option key={d.en} value={d.en}>
                    {locale === "bn" ? `${d.bn} · ${d.en}` : `${d.en} · ${d.bn}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label={t.upazila} htmlFor="upazila">
          <Input id="upazila" name="upazila" maxLength={80} defaultValue={defaults?.upazila ?? ""} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby="segments-hint">
        <legend className="text-sm font-semibold">{t.segments}</legend>
        <p id="segments-hint" className={errors.segments ? "text-sm font-medium text-danger-ink" : "text-sm text-muted"}>
          {t.segmentsHint}
        </p>
        <div className="mt-1 grid gap-2">
          {SEGMENTS.map((s) => (
            <label
              key={s}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="checkbox"
                name="segments"
                value={s}
                defaultChecked={defaults?.segments?.includes(s) ?? false}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="font-medium">{t.segmentNames[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
