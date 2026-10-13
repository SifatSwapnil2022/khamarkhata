import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { animals, animalSales, auditLogs, listings, sheds, sires } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok, type Result } from "@/lib/result";
import type { Actor } from "./team";

/* ───────────────────────── List ───────────────────────── */

export const GROUPS = ["all", "cows", "calves", "qurbani", "breeding"] as const;
export type Group = (typeof GROUPS)[number];
export const STATUSES = ["pregnant", "milking", "dry", "heat", "withdrawal"] as const;
export type Status = (typeof STATUSES)[number];
export const SORTS = ["tag", "milk", "weight", "age"] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 24;

const GROUP_PURPOSE: Record<Exclude<Group, "all">, string> = {
  cows: "dairy",
  calves: "calf",
  qurbani: "qurbani",
  breeding: "breeding",
};

export type AnimalListItem = {
  id: string;
  tag: string;
  name: string | null;
  nameBn: string | null;
  sex: "female" | "male";
  purpose: "dairy" | "breeding" | "qurbani" | "calf" | "other";
  breedLabel: string | null;
  breedPercent: number | null;
  birthDate: string | null;
  shed: string | null;
  photoUrl: string | null;
  milkAvg: number | null;
  weightKg: number | null;
  adg: number | null;
  pregnant: boolean;
  expectedCalving: string | null;
  inHeat: boolean;
  withdrawal: boolean;
  milking: boolean;
  damTag: string | null;
};

export type ListFilters = { group: Group; q?: string; status?: Status; breed?: string; sort: Sort; page: number };

/**
 * The reference "today" for a farm: its latest milk record, or the calendar date when there is none.
 * Keeps the demo farm (frozen on 13 Oct 2026) and live farms consistent.
 */
const refDate = (farmId: string) =>
  sql`(select coalesce((select max(date) from milk_records where farm_id = ${farmId}), current_date))`;

/** The farm's latest record day as YYYY-MM-DD (see refDate). */
export async function farmRefDate(db: DB, farmId: string): Promise<string> {
  const r = rowsOf<{ d: unknown }>(await db.execute(sql`select ${refDate(farmId)} as d`))[0];
  return isoDate(r?.d) ?? new Date().toISOString().slice(0, 10);
}

export async function listAnimals(db: DB, farmId: string, f: ListFilters, gestationDays = 283) {
  const where: SQL[] = [sql`a.farm_id = ${farmId}`, sql`a.lifecycle = 'active'`];
  if (f.group !== "all") where.push(sql`a.purpose = ${GROUP_PURPOSE[f.group]}::purpose`);
  if (f.q) {
    const like = `%${f.q.trim()}%`;
    where.push(sql`(a.tag ilike ${like} or a.name ilike ${like} or a.name_bn ilike ${like})`);
  }
  if (f.breed) where.push(sql`a.breed_label = ${f.breed}`);
  if (f.status === "pregnant") where.push(sql`preg.animal_id is not null`);
  if (f.status === "milking") where.push(sql`milking.animal_id is not null`);
  if (f.status === "dry") where.push(sql`a.purpose = 'dairy' and milking.animal_id is null`);
  if (f.status === "heat") where.push(sql`heat.animal_id is not null`);
  if (f.status === "withdrawal") where.push(sql`wd.animal_id is not null`);

  const order = {
    // Within "all", group by what the farm keeps the animal for: cows first, calves last.
    tag: sql`case a.purpose when 'dairy' then 1 when 'qurbani' then 2 when 'breeding' then 3 when 'calf' then 4 else 5 end, a.tag asc`,
    milk: sql`milk7.avg desc nulls last, a.tag asc`,
    weight: sql`lastw.weight_kg desc nulls last, a.tag asc`,
    age: sql`a.birth_date asc nulls last, a.tag asc`,
  }[f.sort];

  const res = await db.execute(sql`
    with
      ref as (select ${refDate(farmId)} as d),
      photo as (
        select distinct on (animal_id) animal_id, url from animal_media
        where farm_id = ${farmId} order by animal_id, is_cover desc, created_at
      ),
      milk7 as (
        select m.animal_id, sum(m.litres) / greatest(count(distinct m.date), 1) as avg
        from milk_records m, ref where m.farm_id = ${farmId} and m.date > ref.d - 7 group by 1
      ),
      milking as (select distinct m.animal_id from milk_records m, ref where m.farm_id = ${farmId} and m.date = ref.d),
      lastw as (select distinct on (animal_id) animal_id, weight_kg, date from weigh_ins where farm_id = ${farmId} order by animal_id, date desc),
      firstw as (select distinct on (animal_id) animal_id, weight_kg, date from weigh_ins where farm_id = ${farmId} order by animal_id, date asc),
      preg as (
        select distinct on (p.animal_id) p.animal_id,
          (select max(s.date) from breeding_events s where s.animal_id = p.animal_id and s.type = 'service' and s.date <= p.date) as service_date
        from breeding_events p
        where p.farm_id = ${farmId} and p.type = 'pregnancy_check' and p.pd_result = 'positive'
          and not exists (select 1 from breeding_events c where c.animal_id = p.animal_id and c.type = 'calving' and c.date > p.date)
        order by p.animal_id, p.date desc
      ),
      heat as (select distinct b.animal_id from breeding_events b, ref where b.farm_id = ${farmId} and b.type = 'heat' and b.date = ref.d),
      wd as (select distinct h.animal_id from health_events h, ref where h.farm_id = ${farmId} and h.milk_withdrawal_until >= ref.d)
    select
      a.id, a.tag, a.name, a.name_bn, a.sex, a.purpose, a.breed_label, a.breed_percent, a.birth_date,
      s.name as shed, photo.url as photo_url, milk7.avg as milk_avg, lastw.weight_kg,
      case when lastw.date > firstw.date then (lastw.weight_kg - firstw.weight_kg) / (lastw.date - firstw.date) end as adg,
      preg.animal_id is not null as pregnant,
      preg.service_date + ${gestationDays}::int as expected_calving,
      heat.animal_id is not null as in_heat,
      wd.animal_id is not null as withdrawal,
      milking.animal_id is not null as milking,
      dam.tag as dam_tag,
      count(*) over () as total
    from animals a
      left join sheds s on s.id = a.shed_id
      left join photo on photo.animal_id = a.id
      left join milk7 on milk7.animal_id = a.id
      left join milking on milking.animal_id = a.id
      left join lastw on lastw.animal_id = a.id
      left join firstw on firstw.animal_id = a.id
      left join preg on preg.animal_id = a.id
      left join heat on heat.animal_id = a.id
      left join wd on wd.animal_id = a.id
      left join animals dam on dam.id = a.dam_id
    where ${sql.join(where, sql` and `)}
    order by ${order}
    limit ${PAGE_SIZE} offset ${(Math.max(1, f.page) - 1) * PAGE_SIZE}
  `);

  const rows = rowsOf<Record<string, unknown>>(res);
  const items: AnimalListItem[] = rows.map((r) => ({
    id: String(r.id),
    tag: String(r.tag),
    name: (r.name as string) ?? null,
    nameBn: (r.name_bn as string) ?? null,
    sex: r.sex as AnimalListItem["sex"],
    purpose: r.purpose as AnimalListItem["purpose"],
    breedLabel: (r.breed_label as string) ?? null,
    breedPercent: num(r.breed_percent),
    birthDate: isoDate(r.birth_date),
    shed: (r.shed as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    milkAvg: num(r.milk_avg),
    weightKg: num(r.weight_kg),
    adg: num(r.adg),
    pregnant: Boolean(r.pregnant),
    expectedCalving: isoDate(r.expected_calving),
    inHeat: Boolean(r.in_heat),
    withdrawal: Boolean(r.withdrawal),
    milking: Boolean(r.milking),
    damTag: (r.dam_tag as string) ?? null,
  }));
  return { items, total: Number(rows[0]?.total ?? 0) };
}

export async function groupCounts(db: DB, farmId: string): Promise<Record<Group, number>> {
  const res = await db.execute(sql`
    select purpose, count(*)::int as n from animals
    where farm_id = ${farmId} and lifecycle = 'active' group by purpose`);
  const by = Object.fromEntries(rowsOf<{ purpose: string; n: number }>(res).map((r) => [r.purpose, Number(r.n)]));
  return {
    all: Object.values(by).reduce((a, b) => a + b, 0),
    cows: by.dairy ?? 0,
    calves: by.calf ?? 0,
    qurbani: by.qurbani ?? 0,
    breeding: by.breeding ?? 0,
  };
}

export async function breedOptions(db: DB, farmId: string) {
  const res = await db.execute(sql`
    select breed_label, count(*)::int as n from animals
    where farm_id = ${farmId} and lifecycle = 'active' and breed_label is not null
    group by 1 order by 2 desc, 1`);
  return rowsOf<{ breed_label: string; n: number }>(res).map((r) => r.breed_label);
}

/* ───────────────────────── Profile ───────────────────────── */

export type ParentRef =
  | { kind: "animal"; id: string; tag: string; name: string | null; breedLabel: string | null; photoUrl: string | null }
  | { kind: "straw"; code: string; name: string | null; breedLabel: string | null; source: string | null };

export type PedigreeNode = { self: ParentRef | null; dam: ParentRef | null; sire: ParentRef | null };

async function parentRef(db: DB, farmId: string, animalId: string | null, sireId: string | null): Promise<ParentRef | null> {
  if (animalId) {
    const res = await db.execute(sql`
      select a.id, a.tag, a.name, a.breed_label,
        (select url from animal_media m where m.animal_id = a.id order by is_cover desc limit 1) as photo_url
      from animals a where a.id = ${animalId} and a.farm_id = ${farmId}`);
    const r = rowsOf<Record<string, unknown>>(res)[0];
    if (r) {
      return {
        kind: "animal",
        id: String(r.id),
        tag: String(r.tag),
        name: (r.name as string) ?? null,
        breedLabel: (r.breed_label as string) ?? null,
        photoUrl: (r.photo_url as string) ?? null,
      };
    }
  }
  if (sireId) {
    const [s] = await db.select().from(sires).where(and(eq(sires.id, sireId), eq(sires.farmId, farmId)));
    if (s) return { kind: "straw", code: s.code, name: s.name, breedLabel: s.breedLabel, source: s.source };
  }
  return null;
}

/** Parents of a parent, when that parent is an animal on the farm (straws have no recorded pedigree). */
async function parentsOf(db: DB, farmId: string, ref: ParentRef | null): Promise<{ dam: ParentRef | null; sire: ParentRef | null }> {
  if (!ref || ref.kind !== "animal") return { dam: null, sire: null };
  const [a] = await db
    .select({ damId: animals.damId, sireAnimalId: animals.sireAnimalId, sireId: animals.sireId })
    .from(animals)
    .where(and(eq(animals.id, ref.id), eq(animals.farmId, farmId)));
  if (!a) return { dam: null, sire: null };
  const [dam, sire] = await Promise.all([
    parentRef(db, farmId, a.damId, null),
    parentRef(db, farmId, a.sireAnimalId, a.sireId),
  ]);
  return { dam, sire };
}

export async function getAnimalProfile(db: DB, farmId: string, tag: string, gestationDays = 283) {
  const res = await db.execute(sql`
    select a.*, s.name as shed_name, b.name as breed_name, b.name_bn as breed_name_bn,
      ${refDate(farmId)} as ref_date
    from animals a
      left join sheds s on s.id = a.shed_id
      left join breeds b on b.id = a.breed_id
    where a.farm_id = ${farmId} and a.tag = ${tag.toUpperCase()}`);
  const a = rowsOf<Record<string, unknown>>(res)[0];
  if (!a) return null;
  const id = String(a.id);
  const ref = isoDate(a.ref_date)!;

  const [photos, damRef, sireRef, offspringRes, milkRes, breedingRes, healthRes, weighRes, planRes, listingRes, eidRes] =
    await Promise.all([
      db.execute(sql`select url, credit, source_url from animal_media where animal_id = ${id} order by is_cover desc, created_at`),
      parentRef(db, farmId, (a.dam_id as string) ?? null, null),
      parentRef(db, farmId, (a.sire_animal_id as string) ?? null, (a.sire_id as string) ?? null),
      db.execute(sql`
        select c.tag, c.name, c.sex, c.purpose, c.birth_date, c.lifecycle, c.breed_label,
          (select url from animal_media m where m.animal_id = c.id order by is_cover desc limit 1) as photo_url
        from animals c where c.farm_id = ${farmId} and (c.dam_id = ${id} or c.sire_animal_id = ${id})
        order by c.birth_date desc`),
      db.execute(sql`
        select date,
          sum(case when session = 'am' then litres else 0 end) as am,
          sum(case when session = 'pm' then litres else 0 end) as pm,
          bool_or(under_withdrawal) as withheld
        from milk_records where animal_id = ${id} and date > ${ref}::date - 90
        group by date order by date`),
      db.execute(sql`
        select b.type, b.date, b.method, b.technician, b.pd_result, b.calving_ease, b.notes,
          s.code as straw_code, s.breed_label as straw_breed, bull.tag as bull_tag, bull.name as bull_name,
          calf.tag as calf_tag, calf.sex as calf_sex
        from breeding_events b
          left join sires s on s.id = b.sire_id
          left join animals bull on bull.id = b.sire_animal_id
          left join animals calf on calf.id = b.calf_id
        where b.animal_id = ${id} order by b.date desc, b.created_at desc`),
      db.execute(sql`
        select h.type, h.date, h.diagnosis, h.drug, h.dose, h.vet_name, h.milk_withdrawal_until, h.meat_withdrawal_until,
          h.next_due_date, h.cost_tk, h.notes, v.name as vaccine, v.name_bn as vaccine_bn
        from health_events h left join vaccines v on v.id = h.vaccine_id
        where h.animal_id = ${id} order by h.date desc`),
      db.execute(sql`select date, weight_kg, method, body_condition_score from weigh_ins where animal_id = ${id} order by date`),
      db.execute(sql`select season_year, start_date, start_weight_kg, target_weight_kg, price_per_kg_tk from fattening_plans where animal_id = ${id} order by season_year desc limit 1`),
      db.execute(sql`select slug, title, price_tk, status from listings where animal_id = ${id} order by created_at desc limit 1`),
      db.execute(sql`select value from platform_settings where key like 'eid_ul_adha:%' order by key desc limit 1`),
    ]);

  const [damParents, sireParents] = await Promise.all([parentsOf(db, farmId, damRef), parentsOf(db, farmId, sireRef)]);

  const breeding = rowsOf<Record<string, unknown>>(breedingRes).map((r) => ({
    type: String(r.type),
    date: isoDate(r.date)!,
    method: (r.method as string) ?? null,
    technician: (r.technician as string) ?? null,
    pdResult: (r.pd_result as string) ?? null,
    calvingEase: (r.calving_ease as string) ?? null,
    notes: (r.notes as string) ?? null,
    strawCode: (r.straw_code as string) ?? null,
    strawBreed: (r.straw_breed as string) ?? null,
    bullTag: (r.bull_tag as string) ?? null,
    bullName: (r.bull_name as string) ?? null,
    calfTag: (r.calf_tag as string) ?? null,
    calfSex: (r.calf_sex as string) ?? null,
  }));

  const lastCalving = breeding.find((b) => b.type === "calving")?.date ?? null;
  const lastPd = breeding.find((b) => b.type === "pregnancy_check" && b.pdResult === "positive");
  const pregnant = Boolean(lastPd && (!lastCalving || lastPd.date > lastCalving));
  const lastService = pregnant ? breeding.find((b) => b.type === "service" && b.date <= lastPd!.date) : undefined;
  const expectedCalving = lastService ? addDays(lastService.date, gestationDays) : null;

  const health = rowsOf<Record<string, unknown>>(healthRes).map((r) => ({
    type: String(r.type),
    date: isoDate(r.date)!,
    vaccine: (r.vaccine as string) ?? null,
    vaccineBn: (r.vaccine_bn as string) ?? null,
    diagnosis: (r.diagnosis as string) ?? null,
    drug: (r.drug as string) ?? null,
    dose: (r.dose as string) ?? null,
    vetName: (r.vet_name as string) ?? null,
    milkWithdrawalUntil: isoDate(r.milk_withdrawal_until),
    meatWithdrawalUntil: isoDate(r.meat_withdrawal_until),
    nextDue: isoDate(r.next_due_date),
    costTk: num(r.cost_tk),
    notes: (r.notes as string) ?? null,
  }));
  // Latest record per vaccine decides when the next one is due.
  const vaccineStatus = new Map<string, { vaccine: string; vaccineBn: string | null; last: string; nextDue: string | null }>();
  for (const h of health) {
    if (!h.vaccine || vaccineStatus.has(h.vaccine)) continue;
    vaccineStatus.set(h.vaccine, { vaccine: h.vaccine, vaccineBn: h.vaccineBn, last: h.date, nextDue: h.nextDue });
  }
  const withdrawal = health.find(
    (h) => (h.milkWithdrawalUntil && h.milkWithdrawalUntil >= ref) || (h.meatWithdrawalUntil && h.meatWithdrawalUntil >= ref),
  );

  const weights = rowsOf<Record<string, unknown>>(weighRes).map((r) => ({
    date: isoDate(r.date)!,
    kg: Number(r.weight_kg),
    method: String(r.method),
    bcs: num(r.body_condition_score),
  }));
  const planRow = rowsOf<Record<string, unknown>>(planRes)[0];
  const plan = planRow
    ? {
        season: Number(planRow.season_year),
        startDate: isoDate(planRow.start_date)!,
        startKg: Number(planRow.start_weight_kg),
        targetKg: Number(planRow.target_weight_kg),
        pricePerKg: num(planRow.price_per_kg_tk),
      }
    : null;
  const eidValue = rowsOf<{ value: { date?: string; confirmed?: boolean } | string }>(eidRes)[0]?.value;
  const eid = typeof eidValue === "string" ? (JSON.parse(eidValue) as { date?: string; confirmed?: boolean }) : eidValue;
  const listing = rowsOf<Record<string, unknown>>(listingRes)[0];

  return {
    refDate: ref,
    animal: {
      id,
      tag: String(a.tag),
      govtId: (a.govt_id as string) ?? null,
      name: (a.name as string) ?? null,
      nameBn: (a.name_bn as string) ?? null,
      sex: a.sex as "female" | "male",
      purpose: a.purpose as AnimalListItem["purpose"],
      lifecycle: String(a.lifecycle),
      breedLabel: (a.breed_label as string) ?? null,
      breedPercent: num(a.breed_percent),
      breedName: (a.breed_name as string) ?? null,
      color: (a.color as string) ?? null,
      birthDate: isoDate(a.birth_date),
      birthDateEstimated: Boolean(a.birth_date_estimated),
      origin: String(a.origin),
      purchaseDate: isoDate(a.purchase_date),
      purchasePriceTk: num(a.purchase_price_tk),
      purchasedFrom: (a.purchased_from as string) ?? null,
      shed: (a.shed_name as string) ?? null,
      shedId: (a.shed_id as string) ?? null,
      notes: (a.notes as string) ?? null,
      exitDate: isoDate(a.exit_date),
      exitReason: (a.exit_reason as string) ?? null,
    },
    photos: rowsOf<Record<string, unknown>>(photos).map((p) => ({
      url: String(p.url),
      credit: (p.credit as string) ?? null,
      sourceUrl: (p.source_url as string) ?? null,
    })),
    pedigree: {
      dam: { self: damRef, ...damParents } as PedigreeNode,
      sire: { self: sireRef, ...sireParents } as PedigreeNode,
    },
    offspring: rowsOf<Record<string, unknown>>(offspringRes).map((c) => ({
      tag: String(c.tag),
      name: (c.name as string) ?? null,
      sex: String(c.sex),
      purpose: String(c.purpose),
      birthDate: isoDate(c.birth_date),
      lifecycle: String(c.lifecycle),
      breedLabel: (c.breed_label as string) ?? null,
      photoUrl: (c.photo_url as string) ?? null,
    })),
    milk: rowsOf<Record<string, unknown>>(milkRes).map((m) => ({
      date: isoDate(m.date)!,
      am: Number(m.am),
      pm: Number(m.pm),
      withheld: Boolean(m.withheld),
    })),
    breeding,
    reproduction: { lastCalving, pregnant, lastService: lastService?.date ?? null, expectedCalving },
    health,
    vaccines: [...vaccineStatus.values()],
    withdrawal: withdrawal
      ? { reason: withdrawal.diagnosis, milkUntil: withdrawal.milkWithdrawalUntil, meatUntil: withdrawal.meatWithdrawalUntil }
      : null,
    weights,
    plan,
    eid: eid?.date ? { date: eid.date, confirmed: Boolean(eid.confirmed) } : null,
    listing: listing
      ? { slug: String(listing.slug), title: String(listing.title), priceTk: num(listing.price_tk), status: String(listing.status) }
      : null,
  };
}

export type AnimalProfile = NonNullable<Awaited<ReturnType<typeof getAnimalProfile>>>;

export function addDays(isoDay: string, days: number) {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
}

/* ───────────────────────── Create / edit / exit ───────────────────────── */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "date");
const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), "range");

export const animalInput = z
  .object({
    tag: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9][A-Z0-9-/]*$/.test(v), "invalid_tag"),
    name: optionalText(60),
    nameBn: optionalText(60),
    sex: z.enum(["female", "male"]),
    purpose: z.enum(["dairy", "breeding", "qurbani", "calf", "other"]),
    breedLabel: optionalText(60),
    breedPercent: optionalInt(0, 100),
    color: optionalText(60),
    birthDate: optionalDate,
    birthDateEstimated: z.union([z.boolean(), z.string()]).optional().transform((v) => v === true || v === "on"),
    origin: z.enum(["born", "purchased"]),
    purchaseDate: optionalDate,
    purchasePriceTk: optionalInt(0, 50_000_000),
    purchasedFrom: optionalText(120),
    damTag: optionalText(20),
    sireTag: optionalText(20),
    shedId: optionalText(40),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    if (v.purpose === "dairy" && v.sex !== "female") ctx.addIssue({ code: "custom", path: ["sex"], message: "dairy_female" });
    if ((v.purpose === "qurbani" || v.purpose === "breeding") && v.sex !== "male")
      ctx.addIssue({ code: "custom", path: ["sex"], message: "bull_male" });
  });

export type AnimalInput = z.input<typeof animalInput>;
type AnimalError = "forbidden" | "invalid" | "tag_taken" | "not_found";
export type FieldErrors = Record<string, string>;

/** Resolves dam/sire tags to records on the same farm and checks they make sense as parents. */
async function resolveParents(
  db: DB,
  farmId: string,
  v: z.output<typeof animalInput>,
  selfId: string | null,
): Promise<{ ok: true; damId: string | null; sireAnimalId: string | null; sireId: string | null } | { ok: false; fields: FieldErrors }> {
  const fields: FieldErrors = {};
  let damId: string | null = null;
  let sireAnimalId: string | null = null;
  let sireId: string | null = null;

  if (v.damTag) {
    const [dam] = await db.select().from(animals).where(and(eq(animals.farmId, farmId), eq(animals.tag, v.damTag.toUpperCase())));
    if (!dam) fields.damTag = "not_found";
    else if (dam.id === selfId) fields.damTag = "self";
    else if (dam.sex !== "female") fields.damTag = "not_female";
    else if (v.birthDate && dam.birthDate && dam.birthDate >= v.birthDate) fields.damTag = "too_young";
    else damId = dam.id;
  }
  if (v.sireTag) {
    const tag = v.sireTag.toUpperCase();
    const [bull] = await db.select().from(animals).where(and(eq(animals.farmId, farmId), eq(animals.tag, tag)));
    if (bull) {
      if (bull.id === selfId) fields.sireTag = "self";
      else if (bull.sex !== "male") fields.sireTag = "not_male";
      else if (v.birthDate && bull.birthDate && bull.birthDate >= v.birthDate) fields.sireTag = "too_young";
      else sireAnimalId = bull.id;
    } else {
      const [straw] = await db.select().from(sires).where(and(eq(sires.farmId, farmId), eq(sires.code, v.sireTag.trim())));
      if (straw) sireId = straw.id;
      else fields.sireTag = "not_found";
    }
  }
  if (v.shedId) {
    const [shed] = await db.select().from(sheds).where(and(eq(sheds.farmId, farmId), eq(sheds.id, v.shedId)));
    if (!shed) fields.shedId = "not_found";
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, damId, sireAnimalId, sireId };
}

function columnsFrom(v: z.output<typeof animalInput>) {
  return {
    tag: v.tag,
    name: v.name,
    nameBn: v.nameBn,
    sex: v.sex,
    purpose: v.purpose,
    breedLabel: v.breedLabel,
    breedPercent: v.breedPercent,
    color: v.color,
    birthDate: v.birthDate,
    birthDateEstimated: v.birthDateEstimated,
    origin: v.origin,
    purchaseDate: v.origin === "purchased" ? v.purchaseDate : null,
    purchasePriceTk: v.origin === "purchased" ? v.purchasePriceTk : null,
    purchasedFrom: v.origin === "purchased" ? v.purchasedFrom : null,
    shedId: v.shedId,
    notes: v.notes,
  };
}

function zodFields(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message;
  return fields;
}

export async function createAnimal(
  db: DB,
  actor: Actor,
  input: AnimalInput,
): Promise<Result<{ tag: string }, AnimalError> & { fields?: FieldErrors }> {
  if (!can(actor.role, "animal.write")) return err("forbidden");
  const parsed = animalInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid"), fields: zodFields(parsed.error) };
  const v = parsed.data;

  const [taken] = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.farmId, actor.farmId), eq(animals.tag, v.tag)));
  if (taken) return { ...err("tag_taken"), fields: { tag: "taken" } };

  const parents = await resolveParents(db, actor.farmId, v, null);
  if (!parents.ok) return { ...err("invalid"), fields: parents.fields };

  const [row] = await db
    .insert(animals)
    .values({ farmId: actor.farmId, ...columnsFrom(v), damId: parents.damId, sireAnimalId: parents.sireAnimalId, sireId: parents.sireId })
    .returning({ id: animals.id, tag: animals.tag });
  await db.insert(auditLogs).values({
    farmId: actor.farmId,
    actorId: actor.userId,
    action: "animal.create",
    entityType: "animal",
    entityId: row!.id,
    data: { tag: row!.tag },
  });
  return ok({ tag: row!.tag });
}

export async function updateAnimal(
  db: DB,
  actor: Actor,
  animalId: string,
  input: AnimalInput,
): Promise<Result<{ tag: string }, AnimalError> & { fields?: FieldErrors }> {
  if (!can(actor.role, "animal.write")) return err("forbidden");
  const [current] = await db.select().from(animals).where(and(eq(animals.id, animalId), eq(animals.farmId, actor.farmId)));
  if (!current) return err("not_found");
  const parsed = animalInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid"), fields: zodFields(parsed.error) };
  const v = parsed.data;

  if (v.tag !== current.tag) {
    const [taken] = await db.select({ id: animals.id }).from(animals).where(and(eq(animals.farmId, actor.farmId), eq(animals.tag, v.tag)));
    if (taken) return { ...err("tag_taken"), fields: { tag: "taken" } };
  }
  const parents = await resolveParents(db, actor.farmId, v, animalId);
  if (!parents.ok) return { ...err("invalid"), fields: parents.fields };

  await db
    .update(animals)
    .set({ ...columnsFrom(v), damId: parents.damId, sireAnimalId: parents.sireAnimalId, sireId: parents.sireId, updatedAt: new Date() })
    .where(and(eq(animals.id, animalId), eq(animals.farmId, actor.farmId)));
  await db.insert(auditLogs).values({
    farmId: actor.farmId,
    actorId: actor.userId,
    action: "animal.update",
    entityType: "animal",
    entityId: animalId,
    data: { tag: v.tag },
  });
  return ok({ tag: v.tag });
}

export const exitInput = z
  .object({
    lifecycle: z.enum(["sold", "dead", "culled"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: optionalText(300),
    priceTk: optionalInt(0, 50_000_000),
    buyerName: optionalText(120),
    buyerPhone: optionalText(20),
    weightKg: optionalInt(0, 2000),
  })
  .superRefine((v, ctx) => {
    if (v.lifecycle === "sold" && v.priceTk === null) ctx.addIssue({ code: "custom", path: ["priceTk"], message: "sale_price" });
  });

export async function recordExit(
  db: DB,
  actor: Actor,
  animalId: string,
  input: z.input<typeof exitInput>,
): Promise<Result<true, AnimalError> & { fields?: FieldErrors }> {
  if (!can(actor.role, "animal.write")) return err("forbidden");
  const parsed = exitInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid"), fields: zodFields(parsed.error) };
  const v = parsed.data;
  const [current] = await db.select().from(animals).where(and(eq(animals.id, animalId), eq(animals.farmId, actor.farmId)));
  if (!current) return err("not_found");
  if (current.birthDate && v.date < current.birthDate) return { ...err("invalid"), fields: { date: "before_birth" } };

  await db.transaction(async (tx) => {
    await tx
      .update(animals)
      .set({ lifecycle: v.lifecycle, exitDate: v.date, exitReason: v.reason, updatedAt: new Date() })
      .where(eq(animals.id, animalId));
    if (v.lifecycle === "sold") {
      const [listing] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(and(eq(listings.animalId, animalId), eq(listings.status, "active")));
      await tx.insert(animalSales).values({
        farmId: actor.farmId,
        animalId,
        listingId: listing?.id ?? null,
        date: v.date,
        buyerName: v.buyerName,
        buyerPhone: v.buyerPhone,
        priceTk: v.priceTk!,
        weightKg: v.weightKg === null ? null : String(v.weightKg),
      });
    }
    // Whatever the reason, the animal is no longer for sale.
    await tx
      .update(listings)
      .set({ status: v.lifecycle === "sold" ? "sold" : "withdrawn" })
      .where(and(eq(listings.animalId, animalId), eq(listings.status, "active")));
    await tx.insert(auditLogs).values({
      farmId: actor.farmId,
      actorId: actor.userId,
      action: `animal.${v.lifecycle}`,
      entityType: "animal",
      entityId: animalId,
      data: { date: v.date, priceTk: v.priceTk },
    });
  });
  return ok(true);
}

/* ───────────────────────── Form lookups ───────────────────────── */

export async function formOptions(db: DB, farmId: string) {
  const [shedRows, strawRows, parentRows] = await Promise.all([
    db.select({ id: sheds.id, name: sheds.name }).from(sheds).where(eq(sheds.farmId, farmId)).orderBy(asc(sheds.name)),
    db.select({ code: sires.code, breedLabel: sires.breedLabel }).from(sires).where(eq(sires.farmId, farmId)).orderBy(asc(sires.code)),
    db
      .select({ tag: animals.tag, name: animals.name, sex: animals.sex, purpose: animals.purpose })
      .from(animals)
      .where(and(eq(animals.farmId, farmId), sql`${animals.purpose} in ('dairy', 'breeding')`))
      .orderBy(asc(animals.tag)),
  ]);
  return {
    sheds: shedRows,
    straws: strawRows,
    dams: parentRows.filter((p) => p.sex === "female"),
    bulls: parentRows.filter((p) => p.sex === "male"),
  };
}

export async function getAnimalId(db: DB, farmId: string, tag: string) {
  const [row] = await db
    .select({ id: animals.id, lifecycle: animals.lifecycle })
    .from(animals)
    .where(and(eq(animals.farmId, farmId), eq(animals.tag, tag.toUpperCase())));
  return row ?? null;
}
