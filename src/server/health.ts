import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { animals, healthEvents, vaccines } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok } from "@/lib/result";
import { addDays, audit, isoDay, refDay, zodFields, type Actor } from "./common";

const n0 = (v: unknown) => num(v) ?? 0;

export const DUE_SOON_DAYS = 14;

export type VaccineOption = { id: string; name: string; nameBn: string | null; isDeworming: boolean; intervalDays: number };

/** The platform catalogue plus the farm's own entries. */
export async function vaccineOptions(db: DB, farmId: string): Promise<VaccineOption[]> {
  const rows = await db
    .select()
    .from(vaccines)
    .where(or(isNull(vaccines.farmId), eq(vaccines.farmId, farmId)))
    .orderBy(vaccines.isDeworming, vaccines.name);
  return rows.map((v) => ({ id: v.id, name: v.name, nameBn: v.nameBn, isDeworming: v.isDeworming, intervalDays: v.defaultIntervalDays }));
}

export type DueItem = {
  animalId: string;
  tag: string;
  name: string | null;
  nameBn: string | null;
  purpose: string;
  vaccineId: string;
  vaccine: string;
  vaccineBn: string | null;
  lastDate: string;
  dueDate: string;
  overdueDays: number;
};

/**
 * What's due: for each active animal and vaccine, the latest dose's next-due date, when that date
 * is past or within two weeks. Animals that never had a vaccine aren't guessed at.
 */
export async function dueList(db: DB, farmId: string): Promise<{ today: string; items: DueItem[] }> {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    with latest as (
      select distinct on (h.animal_id, h.vaccine_id) h.animal_id, h.vaccine_id, h.date, h.next_due_date
      from health_events h
      where h.farm_id = ${farmId} and h.vaccine_id is not null
      order by h.animal_id, h.vaccine_id, h.date desc
    )
    select a.id as animal_id, a.tag, a.name, a.name_bn, a.purpose::text as purpose,
      v.id as vaccine_id, v.name as vaccine, v.name_bn as vaccine_bn,
      l.date::text as last_date, l.next_due_date::text as due_date,
      (${today}::date - l.next_due_date)::int as overdue_days
    from latest l
    join animals a on a.id = l.animal_id and a.lifecycle = 'active'
    join vaccines v on v.id = l.vaccine_id
    where l.next_due_date <= ${today}::date + ${DUE_SOON_DAYS}::int
    order by l.next_due_date, a.tag
  `);
  return {
    today,
    items: rowsOf<Record<string, unknown>>(res).map((r) => ({
      animalId: String(r.animal_id),
      tag: String(r.tag),
      name: (r.name as string | null) ?? null,
      nameBn: (r.name_bn as string | null) ?? null,
      purpose: String(r.purpose),
      vaccineId: String(r.vaccine_id),
      vaccine: String(r.vaccine),
      vaccineBn: (r.vaccine_bn as string | null) ?? null,
      lastDate: String(r.last_date),
      dueDate: String(r.due_date),
      overdueDays: n0(r.overdue_days),
    })),
  };
}

export type Withdrawal = {
  animalId: string;
  tag: string;
  name: string | null;
  purpose: string;
  drug: string | null;
  diagnosis: string | null;
  date: string;
  milkUntil: string | null;
  meatUntil: string | null;
};

/** Animals whose milk or meat must not be sold yet. Meat matters for Qurbani bulls before Eid. */
export async function activeWithdrawals(db: DB, farmId: string): Promise<Withdrawal[]> {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    select a.id as animal_id, a.tag, a.name, a.purpose::text as purpose, h.drug, h.diagnosis, h.date::text as date,
      case when h.milk_withdrawal_until >= ${today}::date then h.milk_withdrawal_until::text end as milk_until,
      case when h.meat_withdrawal_until >= ${today}::date then h.meat_withdrawal_until::text end as meat_until
    from health_events h join animals a on a.id = h.animal_id and a.lifecycle = 'active'
    where h.farm_id = ${farmId}
      and (h.milk_withdrawal_until >= ${today}::date or h.meat_withdrawal_until >= ${today}::date)
    order by greatest(h.milk_withdrawal_until, h.meat_withdrawal_until) desc
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    animalId: String(r.animal_id),
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    purpose: String(r.purpose),
    drug: (r.drug as string | null) ?? null,
    diagnosis: (r.diagnosis as string | null) ?? null,
    date: String(r.date),
    milkUntil: isoDate(r.milk_until),
    meatUntil: isoDate(r.meat_until),
  }));
}

export async function recentHealth(db: DB, farmId: string, limit = 20) {
  const res = await db.execute(sql`
    select h.id, h.type::text as type, h.date::text as date, a.tag, a.name, h.diagnosis, h.drug, h.vet_name, h.cost_tk, h.notes,
      v.name as vaccine
    from health_events h
    join animals a on a.id = h.animal_id
    left join vaccines v on v.id = h.vaccine_id
    where h.farm_id = ${farmId} and h.type in ('treatment', 'vet_visit', 'observation')
    order by h.date desc, h.created_at desc
    limit ${limit}
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    type: String(r.type) as "treatment" | "vet_visit" | "observation",
    date: String(r.date),
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    diagnosis: (r.diagnosis as string | null) ?? null,
    drug: (r.drug as string | null) ?? null,
    vet: (r.vet_name as string | null) ?? null,
    cost: num(r.cost_tk),
    notes: (r.notes as string | null) ?? null,
  }));
}

/** Coverage: the share of active animals whose latest dose of each core vaccine is still in date. */
export async function coverage(db: DB, farmId: string) {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    with herd as (select id from animals where farm_id = ${farmId} and lifecycle = 'active'),
    latest as (
      select distinct on (h.animal_id, h.vaccine_id) h.animal_id, h.vaccine_id, h.next_due_date
      from health_events h join herd on herd.id = h.animal_id
      where h.vaccine_id is not null
      order by h.animal_id, h.vaccine_id, h.date desc
    )
    select v.id, v.name, v.name_bn,
      count(l.animal_id) filter (where l.next_due_date >= ${today}::date)::int as covered,
      (select count(*) from herd)::int as herd
    from vaccines v left join latest l on l.vaccine_id = v.id
    where v.farm_id is null or v.farm_id = ${farmId}
    group by v.id order by v.is_deworming, v.name
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    nameBn: (r.name_bn as string | null) ?? null,
    covered: n0(r.covered),
    herd: n0(r.herd),
  }));
}

export async function healthCost(db: DB, farmId: string, days = 30) {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    select coalesce(sum(cost_tk), 0)::int as cost, count(*) filter (where type = 'treatment')::int as treatments
    from health_events where farm_id = ${farmId} and date > ${today}::date - ${days}::int
  `);
  const r = rowsOf<Record<string, unknown>>(res)[0] ?? {};
  return { cost: n0(r.cost), treatments: n0(r.treatments) };
}

/* ───────────────────────── Writes ───────────────────────── */

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optInt = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const vaccinationInput = z.object({
  vaccineId: z.string().uuid("required"),
  date: z.string().regex(isoDay, "date"),
  nextDueDate: z.union([z.literal(""), z.string().regex(isoDay, "date")]).optional(),
  batchNo: optText(40),
  vetName: optText(80),
  costPerHeadTk: optInt,
  animalIds: z.array(z.string().uuid()).min(1, "pick_animals").max(1000),
});

/** One dose to many animals: a herd vaccination day. The next due date defaults to the vaccine's interval. */
export async function recordVaccination(db: DB, actor: Actor, input: z.input<typeof vaccinationInput>, today: string) {
  if (!can(actor.role, "health.record")) return err("forbidden" as const);
  const parsed = vaccinationInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  if (v.date > today) return { ...err("invalid" as const), fields: { date: "future" } };
  const [vaccine] = await db
    .select()
    .from(vaccines)
    .where(and(eq(vaccines.id, v.vaccineId), or(isNull(vaccines.farmId), eq(vaccines.farmId, actor.farmId))))
    .limit(1);
  if (!vaccine) return { ...err("invalid" as const), fields: { vaccineId: "required" } };
  const next = v.nextDueDate || addDays(v.date, vaccine.defaultIntervalDays);
  if (next <= v.date) return { ...err("invalid" as const), fields: { nextDueDate: "after" } };

  const herd = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.farmId, actor.farmId), eq(animals.lifecycle, "active"), inArray(animals.id, v.animalIds)));
  if (herd.length === 0) return { ...err("invalid" as const), fields: { animalIds: "pick_animals" } };

  await db.insert(healthEvents).values(
    herd.map((a) => ({
      farmId: actor.farmId,
      animalId: a.id,
      type: vaccine.isDeworming ? ("deworming" as const) : ("vaccine" as const),
      date: v.date,
      vaccineId: vaccine.id,
      batchNo: v.batchNo,
      vetName: v.vetName,
      nextDueDate: next,
      costTk: v.costPerHeadTk,
      recordedById: actor.userId,
    })),
  );
  await audit(db, actor, "health.vaccinate", "vaccine", vaccine.id, { date: v.date, animals: herd.length });
  return ok({ count: herd.length, vaccine: vaccine.name, next });
}

const treatmentInput = z.object({
  tag: z.string().trim().min(1, "required").max(20),
  type: z.enum(["treatment", "vet_visit", "observation"]),
  date: z.string().regex(isoDay, "date"),
  diagnosis: optText(160),
  drug: optText(120),
  dose: optText(120),
  vetName: optText(80),
  milkWithdrawalDays: optInt,
  meatWithdrawalDays: optInt,
  costTk: optInt,
  notes: optText(500),
});

/** A treatment or visit. Withdrawal is entered in days, as written on the drug label, and stored as dates. */
export async function recordTreatment(db: DB, actor: Actor, input: z.input<typeof treatmentInput>, today: string) {
  if (!can(actor.role, "health.record")) return err("forbidden" as const);
  const parsed = treatmentInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  if (v.date > today) return { ...err("invalid" as const), fields: { date: "future" } };
  if (v.type === "treatment" && !v.diagnosis) return { ...err("invalid" as const), fields: { diagnosis: "required" } };
  if ((v.milkWithdrawalDays ?? 0) > 120 || (v.meatWithdrawalDays ?? 0) > 365)
    return { ...err("invalid" as const), fields: { [(v.milkWithdrawalDays ?? 0) > 120 ? "milkWithdrawalDays" : "meatWithdrawalDays"]: "range" } };
  const [animal] = await db
    .select({ id: animals.id, tag: animals.tag, sex: animals.sex, purpose: animals.purpose })
    .from(animals)
    .where(and(eq(animals.farmId, actor.farmId), eq(animals.lifecycle, "active"), sql`upper(${animals.tag}) = upper(${v.tag})`))
    .limit(1);
  if (!animal) return { ...err("invalid" as const), fields: { tag: "not_found" } };
  const milkUntil = v.milkWithdrawalDays ? addDays(v.date, v.milkWithdrawalDays) : null;
  if (milkUntil && animal.sex !== "female") return { ...err("invalid" as const), fields: { milkWithdrawalDays: "not_female" } };
  const [row] = await db
    .insert(healthEvents)
    .values({
      farmId: actor.farmId,
      animalId: animal.id,
      type: v.type,
      date: v.date,
      diagnosis: v.diagnosis,
      drug: v.drug,
      dose: v.dose,
      vetName: v.vetName,
      milkWithdrawalUntil: milkUntil,
      meatWithdrawalUntil: v.meatWithdrawalDays ? addDays(v.date, v.meatWithdrawalDays) : null,
      costTk: v.costTk,
      notes: v.notes,
      recordedById: actor.userId,
    })
    .returning({ id: healthEvents.id });
  await audit(db, actor, "health.treat", "health_event", row!.id, { tag: animal.tag });
  return ok({ tag: animal.tag });
}

/** Active animals for the vaccination picker, with whether each is due for the chosen vaccine. */
export async function pickerAnimals(db: DB, farmId: string) {
  const res = await db.execute(sql`
    select a.id, a.tag, a.name, a.purpose::text as purpose, s.name as shed
    from animals a left join sheds s on s.id = a.shed_id
    where a.farm_id = ${farmId} and a.lifecycle = 'active'
    order by case a.purpose when 'dairy' then 1 when 'calf' then 2 when 'qurbani' then 3 when 'breeding' then 4 else 5 end, a.tag
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    purpose: String(r.purpose),
    shed: (r.shed as string | null) ?? null,
  }));
}
