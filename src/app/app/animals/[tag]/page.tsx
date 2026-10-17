import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge, buttonClass, Card, EarTag, type BadgeTone } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import type { AnimalsDict } from "@/i18n/animals";
import { fill, formatter, type Fmt } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { addDays, daysBetween, getAnimalProfile, type AnimalProfile, type ParentRef, type PedigreeNode } from "@/server/animals";
import { coatLabel } from "@/lib/coat";
import { PhotoButton } from "./PhotoButton";
import { AnimalPhoto } from "../AnimalPhoto";
import { MilkChart, WeightChart } from "./charts";

type Params = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tag } = await params;
  return { title: decodeURIComponent(tag).toUpperCase() };
}

export default async function AnimalPage({ params }: Params) {
  const [{ locale, t }, ctx, { tag }] = await Promise.all([getDictionary(), requireFarm(), params]);
  const a = t.animals;
  const p = a.profile;
  const db = await getDb();
  const profile = await getAnimalProfile(db, ctx.farm.id, decodeURIComponent(tag), ctx.farm.settings.gestationDays);
  if (!profile) notFound();
  const fmt = formatter(locale);
  const { animal, refDate: today } = profile;
  const name = (locale === "bn" ? animal.nameBn ?? animal.name : animal.name ?? animal.nameBn) ?? animal.tag;
  const altName = locale === "bn" ? (animal.nameBn ? animal.name : null) : animal.nameBn;
  const kind = animal.purpose === "calf" ? a.calfSex[animal.sex] : a.purpose[animal.purpose];
  const breed = animal.breedLabel
    ? `${animal.breedLabel}${animal.breedPercent && animal.breedLabel.includes("×") ? ` ${animal.breedPercent}%` : ""}`
    : null;
  const photo = profile.photos[0] ?? null;
  const canWrite = can(ctx.role, "animal.write") && animal.lifecycle === "active";

  /* Status chips */
  const chips: { label: string; tone: BadgeTone }[] = [];
  if (animal.lifecycle !== "active") {
    chips.push({ label: `${p.exited[animal.lifecycle as keyof typeof p.exited] ?? animal.lifecycle} · ${fmt.date(animal.exitDate)}`, tone: "dark" });
  }
  if (profile.reproduction.pregnant && profile.reproduction.expectedCalving) {
    chips.push({ label: fill(p.pregnantDue, { date: fmt.date(profile.reproduction.expectedCalving) }), tone: "green" });
  }
  if (profile.breeding.some((b) => b.type === "heat" && b.date === today)) chips.push({ label: p.inHeat, tone: "warn" });
  if (profile.withdrawal?.milkUntil && profile.withdrawal.milkUntil >= today) {
    chips.push({ label: fill(p.withheld, { date: fmt.date(profile.withdrawal.milkUntil) }), tone: "danger" });
  } else if (profile.withdrawal?.meatUntil) {
    chips.push({ label: fill(p.meatWithheld, { date: fmt.date(profile.withdrawal.meatUntil) }), tone: "danger" });
  }
  if (profile.listing?.status === "active") chips.push({ label: `${p.listed} · ${fmt.tk(profile.listing.priceTk)}`, tone: "warn" });

  /* Key figures, depending on what the animal is kept for */
  const stats = keyStats(profile, a, fmt, today);

  /* Weight projection to Eid for fattening bulls */
  const lastW = profile.weights.at(-1);
  const firstW = profile.weights[0];
  const adg = lastW && firstW && lastW.date > firstW.date ? (lastW.kg - firstW.kg) / daysBetween(firstW.date, lastW.date) : null;
  const eidDate = profile.eid?.date ?? null;
  const projection =
    animal.purpose === "qurbani" && lastW && adg && eidDate && eidDate > lastW.date
      ? { date: eidDate, kg: Math.round(lastW.kg + adg * daysBetween(lastW.date, eidDate)) }
      : null;

  return (
    <>
      {/* ───── Hero: big photo, name and status ───── */}
      <div className="page-column pt-3 lg:pt-8">
        <Link href="/app/animals" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-muted no-underline hover:text-primary">
          ← {p.back}
        </Link>
        <div className="mt-2 grid overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <figure className="relative min-w-0">
            <AnimalPhoto
              url={photo?.url ?? null}
              alt={name}
              noPhotoLabel={a.noPhoto}
              sizes="(min-width: 1240px) 620px, (min-width: 768px) 55vw, 100vw"
              className="aspect-[4/3] h-full w-full md:aspect-auto md:min-h-[420px]"
              priority
            />
            {photo?.credit ? (
              <figcaption className="absolute right-3 bottom-3 rounded-full bg-black/50 px-2.5 py-0.5 text-[12px] text-white">
                {p.photoBy}{" "}
                {photo.sourceUrl ? (
                  <a href={photo.sourceUrl} className="text-white underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                    {photo.credit}
                  </a>
                ) : (
                  photo.credit
                )}
              </figcaption>
            ) : null}
            {canWrite ? (
              <div className="absolute top-3 left-3">
                <PhotoButton tag={animal.tag} hasPhoto={Boolean(photo)} t={a.photo} />
              </div>
            ) : null}
          </figure>
          <div className="flex min-w-0 flex-col p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <EarTag tag={animal.tag} className="text-[15px]" />
              <span className="text-[15px] font-medium text-muted">{kind}</span>
            </div>
            <h1 className="mt-3 text-[length:var(--text-title)] leading-[1.05] font-extrabold text-balance">{name}</h1>
            {altName ? (
              <p className="mt-1 text-xl text-muted" lang={locale === "bn" ? "en" : "bn"}>
                {altName}
              </p>
            ) : null}
            <p className="mt-3 text-[17px] text-ink-2">
              {[breed, coatLabel(animal.color, locale), fmt.age(animal.birthDate, today, a.ageFmt), animal.shed].filter(Boolean).join(" · ")}
            </p>
            {chips.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <Badge key={c.label} tone={c.tone} className="px-3 py-1 text-sm">
                    {c.label}
                  </Badge>
                ))}
              </div>
            ) : null}
            <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 md:mt-auto">
              {stats.slice(0, 4).map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className={clsx("font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] tabular", s.tone === "warn" && "text-warn-ink")}>
                    {s.value}
                    {s.unit ? <span className="ml-1 font-sans text-sm font-medium tracking-normal text-muted">{s.unit}</span> : null}
                  </dd>
                  {s.note ? <dd className="text-[13px] text-muted">{s.note}</dd> : null}
                </div>
              ))}
            </dl>
            {canWrite ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={`/app/animals/${encodeURIComponent(animal.tag)}/edit`} className={buttonClass("primary")}>
                  {p.edit}
                </Link>
                <Link href={`/app/animals/${encodeURIComponent(animal.tag)}/exit`} className={buttonClass("secondary")}>
                  {p.exit}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="page-column flex flex-col gap-10 pt-8 pb-12">
        {stats.length > 4 ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:gap-4">
            {stats.slice(4).map((s) => (
              <Card key={s.label}>
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className={clsx("mt-1 font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em] tabular", s.tone === "warn" && "text-warn-ink")}>
                  {s.value}
                  {s.unit ? <span className="ml-1.5 font-sans text-sm font-medium tracking-normal text-muted">{s.unit}</span> : null}
                </dd>
                {s.note ? <dd className="mt-1 text-sm text-muted">{s.note}</dd> : null}
              </Card>
            ))}
          </dl>
        ) : null}

        {/* ───── Charts ───── */}
        {profile.milk.length > 0 ? (
          <Section title={p.milkChart} aside={fill(p.milkTotal, { litres: fmt.n(profile.milk.reduce((s, d) => s + d.am + d.pm, 0)) })}>
            <Card>
              <p className="mb-3 text-sm text-muted">{p.milkChartNote}</p>
              <MilkChart
                data={profile.milk}
                locale={locale}
                labels={{ am: p.am, pm: p.pm, total: p.total, withheld: p.withheldDay, unit: a.litre, tableToggle: p.tableToggle, dateCol: p.dateCol }}
              />
            </Card>
          </Section>
        ) : null}

        {profile.weights.length > 0 && animal.purpose !== "dairy" ? (
          <Section title={p.weightChart}>
            <Card>
              <p className="mb-3 text-sm text-muted">{projection ? p.weightChartNote : p.weightChartNoteSimple}</p>
              <WeightChart
                points={profile.weights.map((w) => ({ date: w.date, kg: w.kg }))}
                projection={
                  projection
                    ? { ...projection, label: `${p.eid} · ${fmt.n(projection.kg)} ${a.kg}` }
                    : null
                }
                target={profile.plan ? { kg: profile.plan.targetKg, label: fill(p.targetLine, { kg: fmt.n(profile.plan.targetKg) }) } : null}
                locale={locale}
                labels={{ unit: a.kg, tableToggle: p.tableToggle, dateCol: p.dateCol, weightCol: p.weightCol, projection: p.projection }}
              />
            </Card>
          </Section>
        ) : null}

        {/* ───── Pedigree + details ───── */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Section title={p.pedigree} aside={p.pedigreeNote}>
            <Pedigree self={{ tag: animal.tag, name, breed, photoUrl: photo?.url ?? null }} dam={profile.pedigree.dam} sire={profile.pedigree.sire} a={a} />
          </Section>
          <Section title={p.details}>
            <Card>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Detail label={p.born}>
                  {fmt.date(animal.birthDate)}
                  {animal.birthDateEstimated ? <span className="text-muted"> ({p.estimated})</span> : null}
                </Detail>
                <Detail label={a.form.origin}>{p.origin[animal.origin as "born" | "purchased"]}</Detail>
                {animal.origin === "purchased" ? (
                  <Detail label={a.form.purchaseDate}>
                    {fmt.date(animal.purchaseDate)}
                    {animal.purchasedFrom ? <span className="block text-sm text-muted">{animal.purchasedFrom}</span> : null}
                  </Detail>
                ) : null}
                {animal.purchasePriceTk ? <Detail label={a.form.purchasePrice}>{fmt.tk(animal.purchasePriceTk)}</Detail> : null}
                <Detail label={a.form.sex}>{a.sex[animal.sex]}</Detail>
                {animal.color ? <Detail label={p.color}>{coatLabel(animal.color, locale)}</Detail> : null}
                {animal.shed ? <Detail label={a.shed}>{animal.shed}</Detail> : null}
                {animal.govtId ? <Detail label={p.govtId}>{animal.govtId}</Detail> : null}
              </dl>
              {animal.notes ? (
                <p className="mt-5 border-t border-line pt-4 text-[15px] text-ink-2">{animal.notes}</p>
              ) : null}
            </Card>
          </Section>
        </div>

        {/* ───── Offspring ───── */}
        {profile.offspring.length > 0 || animal.purpose === "dairy" || animal.purpose === "breeding" ? (
          <Section title={p.offspring} aside={profile.offspring.length ? fmt.n(profile.offspring.length) : undefined}>
            {profile.offspring.length === 0 ? (
              <p className="text-muted">{p.noOffspring}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {profile.offspring.map((o) => (
                  <li key={o.tag}>
                    <Link href={`/app/animals/${encodeURIComponent(o.tag)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-ink no-underline shadow-[var(--shadow-card)] hover:border-primary/40">
                      <AnimalPhoto url={o.photoUrl} alt="" noPhotoLabel="" sizes="56px" className="size-14 shrink-0 rounded-xl [&_span]:hidden [&_svg]:h-7 [&_svg]:w-9" />
                      <span className="min-w-0">
                        <EarTag tag={o.tag} />
                        <span className="mt-1 block truncate text-sm font-semibold">{o.name ?? (o.purpose === "calf" ? a.calfSex[o.sex as "female" | "male"] : a.purpose[o.purpose as keyof AnimalsDict["purpose"]])}</span>
                        <span className="block text-[13px] text-muted">{fmt.date(o.birthDate)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        {/* ───── Breeding + health ───── */}
        <div className="grid gap-10 lg:grid-cols-2">
          {animal.sex === "female" && animal.purpose !== "calf" ? (
            <Section title={p.breeding}>
              {profile.breeding.length === 0 ? (
                <p className="text-muted">{p.noBreeding}</p>
              ) : (
                <ol className="relative flex flex-col gap-0 border-l-2 border-line-strong pl-6">
                  {profile.breeding.slice(0, 14).map((b, i) => (
                    <li key={`${b.type}-${b.date}-${i}`} className="relative pb-5 last:pb-0">
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "absolute top-1.5 -left-[31px] size-3 rounded-full ring-4 ring-ground",
                          b.type === "calving" ? "bg-primary" : b.type === "service" ? "bg-fresh" : b.type === "pregnancy_check" ? "bg-ink" : "bg-line-strong",
                        )}
                      />
                      <p className="text-[13px] font-medium text-muted tabular">{fmt.date(b.date)}</p>
                      <p className="font-semibold">
                        {p.events[b.type as keyof typeof p.events] ?? b.type}
                        {b.pdResult ? ` · ${p.pd[b.pdResult as keyof typeof p.pd]}` : ""}
                      </p>
                      <p className="text-sm text-ink-2">{breedingDetail(b, a)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          ) : null}

          <Section title={p.health}>
            <div className="flex flex-col gap-6">
              {profile.vaccines.length ? (
                <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
                  <table className="w-full min-w-[420px] text-left">
                    <caption className="sr-only">{p.vaccines}</caption>
                    <thead>
                      <tr className="text-sm text-muted">
                        <th scope="col" className="border-b border-line px-4 py-3 font-semibold">{p.vaccine}</th>
                        <th scope="col" className="border-b border-line px-4 py-3 font-semibold">{p.lastGiven}</th>
                        <th scope="col" className="border-b border-line px-4 py-3 font-semibold">{p.nextDue}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.vaccines.map((v) => {
                        const state = !v.nextDue ? "ok" : v.nextDue < today ? "overdue" : daysBetween(today, v.nextDue) <= 14 ? "soon" : "ok";
                        return (
                          <tr key={v.vaccine} className="border-b border-line last:border-0">
                            <td className="px-4 py-3 font-semibold">
                              {locale === "bn" && v.vaccineBn ? v.vaccineBn : v.vaccine}
                            </td>
                            <td className="px-4 py-3 text-sm tabular">{fmt.date(v.last)}</td>
                            <td className="px-4 py-3">
                              <span className="text-sm tabular">{fmt.date(v.nextDue)}</span>{" "}
                              {state !== "ok" ? (
                                <Badge tone={state === "overdue" ? "danger" : "warn"} className="ml-1">
                                  {state === "overdue" ? p.overdue : p.dueSoon}
                                </Badge>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div>
                <h3 className="mb-3 font-display text-lg font-bold">{p.treatments}</h3>
                {profile.health.filter((h) => h.type === "treatment" || h.type === "vet_visit").length === 0 ? (
                  <p className="text-muted">{p.noTreatments}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {profile.health
                      .filter((h) => h.type === "treatment" || h.type === "vet_visit")
                      .map((h, i) => (
                        <li key={`${h.date}-${i}`} className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
                          <p className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-semibold">{h.diagnosis ?? p.healthTypes[h.type as keyof typeof p.healthTypes]}</span>
                            <span className="text-[13px] font-medium text-muted tabular">{fmt.date(h.date)}</span>
                          </p>
                          {h.drug ? (
                            <p className="mt-1 text-sm text-ink-2">
                              {h.drug}
                              {h.dose ? ` · ${h.dose}` : ""}
                            </p>
                          ) : null}
                          {h.notes ? <p className="mt-1 text-sm text-ink-2">{h.notes}</p> : null}
                          <p className="mt-2 flex flex-wrap gap-1.5">
                            {h.milkWithdrawalUntil ? (
                              <Badge tone={h.milkWithdrawalUntil >= today ? "danger" : "plain"}>{fill(p.withheld, { date: fmt.short(h.milkWithdrawalUntil) })}</Badge>
                            ) : null}
                            {h.meatWithdrawalUntil ? (
                              <Badge tone={h.meatWithdrawalUntil >= today ? "danger" : "plain"}>{fill(p.meatWithheld, { date: fmt.short(h.meatWithdrawalUntil) })}</Badge>
                            ) : null}
                            {h.costTk ? <Badge>{`${p.cost} ${fmt.tk(h.costTk)}`}</Badge> : null}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="section-title">
        <span>{title}</span>
        {aside ? <span className="font-sans text-sm font-normal text-muted">{aside}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

type Stat = { label: string; value: string; unit?: string; note?: string; tone?: "warn" };

function keyStats(profile: AnimalProfile, a: AnimalsDict, fmt: Fmt, today: string): Stat[] {
  const s = a.profile.stats;
  const { animal, reproduction } = profile;
  const lastW = profile.weights.at(-1);
  const firstW = profile.weights[0];
  const adg = lastW && firstW && lastW.date > firstW.date ? (lastW.kg - firstW.kg) / daysBetween(firstW.date, lastW.date) : null;
  const age: Stat = { label: s.ageNow, value: fmt.age(animal.birthDate, today, a.ageFmt) };

  if (animal.purpose === "dairy") {
    const last7 = profile.milk.slice(-7);
    const avg = last7.length ? last7.reduce((t, d) => t + d.am + d.pm, 0) / last7.length : null;
    const milkingToday = profile.milk.at(-1)?.date === today;
    const calvings = profile.breeding.filter((b) => b.type === "calving").length;
    const out: Stat[] = [
      milkingToday
        ? { label: s.milkAvg, value: fmt.n(avg, 1), unit: a.perDay }
        : { label: s.milkAvg, value: s.dry },
      {
        label: s.dim,
        value: milkingToday && reproduction.lastCalving ? fmt.n(daysBetween(reproduction.lastCalving, today)) : "—",
        note: reproduction.lastCalving ? `${a.profile.events.calving} ${fmt.date(reproduction.lastCalving)}` : undefined,
      },
      { label: s.lactation, value: calvings ? fmt.n(calvings) : "—" },
    ];
    if (reproduction.pregnant && reproduction.expectedCalving) {
      const days = daysBetween(today, reproduction.expectedCalving);
      out.push({
        label: s.expected,
        value: fmt.short(reproduction.expectedCalving),
        note: milkingToday ? `${s.dryOff} ${fmt.short(addDays(reproduction.expectedCalving, -60))}` : `${fmt.n(days)} ${a.ageFmt.d}`,
        tone: milkingToday && addDays(reproduction.expectedCalving, -60) <= addDays(today, 14) ? "warn" : undefined,
      });
    } else {
      out.push({ label: s.expected, value: s.notPregnant });
    }
    return out;
  }

  if (animal.purpose === "qurbani") {
    const eid = profile.eid?.date ?? null;
    const daysToEid = eid ? daysBetween(today, eid) : null;
    const projected = lastW && adg && eid ? Math.round(lastW.kg + adg * daysBetween(lastW.date, eid)) : null;
    const behind = projected !== null && profile.plan ? projected < profile.plan.targetKg : false;
    return [
      { label: s.weight, value: fmt.n(lastW?.kg), unit: a.kg, note: lastW ? fmt.date(lastW.date) : undefined },
      { label: s.adg, value: fmt.n(adg, 2), unit: a.kgPerDay },
      {
        label: s.projected,
        value: fmt.n(projected),
        unit: a.kg,
        note: profile.plan ? `${s.target} ${fmt.n(profile.plan.targetKg)} ${a.kg}` : undefined,
        tone: behind ? "warn" : undefined,
      },
      { label: s.toEid, value: fmt.n(daysToEid), unit: a.ageFmt.d, note: eid ? `${fmt.date(eid)} (${a.profile.eidApprox})` : undefined },
    ];
  }

  if (animal.purpose === "breeding") {
    return [
      { label: s.weight, value: fmt.n(lastW?.kg), unit: a.kg, note: lastW ? fmt.date(lastW.date) : undefined },
      age,
      { label: s.offspring, value: fmt.n(profile.offspring.length) },
    ];
  }

  // Calves and others
  return [age, { label: s.weight, value: fmt.n(lastW?.kg), unit: a.kg, note: lastW ? fmt.date(lastW.date) : undefined }, { label: s.adg, value: fmt.n(adg, 2), unit: a.kgPerDay }];
}

function breedingDetail(b: AnimalProfile["breeding"][number], a: AnimalsDict) {
  const p = a.profile;
  const parts: string[] = [];
  if (b.method) parts.push(p.method[b.method as keyof typeof p.method]);
  if (b.strawCode) parts.push(`${b.strawCode}${b.strawBreed ? ` (${b.strawBreed})` : ""}`);
  if (b.bullTag) parts.push(`${b.bullName ?? ""} ${b.bullTag}`.trim());
  if (b.technician && b.method === "ai") parts.push(b.technician);
  if (b.calfTag) parts.push(`${p.calf} ${b.calfTag}`);
  if (b.notes) parts.push(b.notes);
  return parts.join(" · ");
}

/* Pedigree: the animal, its parents, and its grandparents where they're on the farm. */
function Pedigree({
  self,
  dam,
  sire,
  a,
}: {
  self: { tag: string; name: string; breed: string | null; photoUrl: string | null };
  dam: PedigreeNode;
  sire: PedigreeNode;
  a: AnimalsDict;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[620px] grid-cols-[1fr_1fr_1fr] items-center gap-x-6">
        <div className="row-span-4 self-center">
          <div className="rounded-2xl bg-deep p-4 text-white">
            <EarTag tag={self.tag} />
            <p className="mt-2 font-display text-lg font-bold">{self.name}</p>
            {self.breed ? <p className="text-sm opacity-80">{self.breed}</p> : null}
          </div>
        </div>
        <div className="row-span-2 py-2">
          <ParentCard role={a.dam} node={dam.self} a={a} />
        </div>
        <div className="flex flex-col gap-2 py-2">
          <ParentCard role={`${a.dam} · ${a.dam}`} node={dam.dam} a={a} small />
        </div>
        <div className="flex flex-col gap-2 py-2">
          <ParentCard role={`${a.dam} · ${a.sire}`} node={dam.sire} a={a} small />
        </div>
        <div className="row-span-2 py-2">
          <ParentCard role={a.sire} node={sire.self} a={a} />
        </div>
        <div className="flex flex-col gap-2 py-2">
          <ParentCard role={`${a.sire} · ${a.dam}`} node={sire.dam} a={a} small />
        </div>
        <div className="flex flex-col gap-2 py-2">
          <ParentCard role={`${a.sire} · ${a.sire}`} node={sire.sire} a={a} small />
        </div>
      </div>
    </div>
  );
}

function ParentCard({ role, node, a, small = false }: { role: string; node: ParentRef | null; a: AnimalsDict; small?: boolean }) {
  const base = clsx("block rounded-xl border p-3", small ? "text-sm" : "");
  if (!node) {
    return (
      <div className={clsx(base, "border-dashed border-line-strong bg-transparent")}>
        <p className="text-[13px] text-muted">{role}</p>
        <p className="text-muted">{a.profile.unknown}</p>
      </div>
    );
  }
  if (node.kind === "straw") {
    return (
      <div className={clsx(base, "border-line bg-surface")}>
        <p className="text-[13px] text-muted">
          {role} · {a.profile.straw}
        </p>
        <p className="font-semibold tabular">{node.code}</p>
        <p className="text-[13px] text-ink-2">{[node.breedLabel, node.source].filter(Boolean).join(" · ")}</p>
      </div>
    );
  }
  return (
    <Link href={`/app/animals/${encodeURIComponent(node.tag)}`} className={clsx(base, "border-line bg-surface text-ink no-underline shadow-[var(--shadow-card)] hover:border-primary/50")}>
      <p className="text-[13px] text-muted">{role}</p>
      <p className="flex flex-wrap items-center gap-2">
        <EarTag tag={node.tag} />
        <span className="font-semibold">{node.name ?? ""}</span>
      </p>
      {node.breedLabel ? <p className="mt-0.5 text-[13px] text-ink-2">{node.breedLabel}</p> : null}
    </Link>
  );
}
