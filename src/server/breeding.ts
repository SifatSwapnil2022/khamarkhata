import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, rowsOf } from "@/db/rows";
import { animals, breedingEvents, DEFAULT_FARM_SETTINGS, sires, type FarmSettings } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok } from "@/lib/result";
import { addDays, audit, daysBetween, isoDay, refDay, zodFields, type Actor } from "./common";

/** Heifers join the breeding list from this age. */
const HEIFER_BREEDING_AGE_DAYS = 14 * 30;
/** After calving, cows rest this long before service (voluntary waiting period). */
const VOLUNTARY_WAIT_DAYS = 60;
/** Open longer than this after calving is a problem worth a vet's look. */
const OPEN_TOO_LONG_DAYS = 120;

export type CowStatus = "pregnant" | "served" | "open" | "fresh" | "heifer";

export type CowBreeding = {
  id: string;
  tag: string;
  name: string | null;
  nameBn: string | null;
  purpose: string;
  status: CowStatus;
  lastCalving: string | null;
  lastHeat: string | null;
  lastService: { date: string; sire: string | null; method: string | null } | null;
  services: number; // since last calving
  daysOpen: number | null;
  expectedCalving: string | null;
  dried: boolean;
  next: { type: UpcomingType; date: string } | null;
};

export type UpcomingType = "heat_watch" | "pd_due" | "dry_off" | "calving" | "ready_to_serve" | "open_long";

type Ev = {
  animalId: string;
  type: string;
  date: string;
  pdResult: string | null;
  method: string | null;
  sire: string | null;
};

/** Breeding status of every breedable female, worked out from her event history. */
export async function herdBreeding(db: DB, farmId: string, settings: FarmSettings = DEFAULT_FARM_SETTINGS) {
  const today = await refDay(db, farmId);
  const cowsRes = await db.execute(sql`
    select a.id, a.tag, a.name, a.name_bn, a.purpose::text as purpose, a.birth_date::text as birth_date
    from animals a
    where a.farm_id = ${farmId} and a.lifecycle = 'active' and a.sex = 'female'
      and (a.purpose = 'dairy' or (a.purpose = 'calf' and a.birth_date <= ${today}::date - ${HEIFER_BREEDING_AGE_DAYS}::int))
    order by a.tag
  `);
  const evRes = await db.execute(sql`
    select b.animal_id, b.type::text as type, b.date::text as date, b.pd_result::text as pd_result, b.method::text as method,
      coalesce(s.code, ba.tag) as sire
    from breeding_events b
    left join sires s on s.id = b.sire_id
    left join animals ba on ba.id = b.sire_animal_id
    where b.farm_id = ${farmId} and b.date <= ${today}::date
    order by b.date, b.created_at
  `);
  const events = new Map<string, Ev[]>();
  for (const r of rowsOf<Record<string, unknown>>(evRes)) {
    const id = String(r.animal_id);
    events.set(id, [
      ...(events.get(id) ?? []),
      {
        animalId: id,
        type: String(r.type),
        date: isoDate(r.date)!,
        pdResult: (r.pd_result as string | null) ?? null,
        method: (r.method as string | null) ?? null,
        sire: (r.sire as string | null) ?? null,
      },
    ]);
  }

  const cows: CowBreeding[] = rowsOf<Record<string, unknown>>(cowsRes).map((r) => {
    const id = String(r.id);
    const ev = events.get(id) ?? [];
    const lastCalving = [...ev].reverse().find((e) => e.type === "calving" || e.type === "abortion")?.date ?? null;
    const since = ev.filter((e) => !lastCalving || e.date > lastCalving);
    const lastHeat = [...ev].reverse().find((e) => e.type === "heat")?.date ?? null;
    const svc = [...since].reverse().find((e) => e.type === "service") ?? null;
    const pdAfter = svc ? [...since].reverse().find((e) => e.type === "pregnancy_check" && e.date > svc.date) : undefined;
    const dried = since.some((e) => e.type === "dry_off");
    const isHeifer = String(r.purpose) === "calf" && !lastCalving;

    let status: CowStatus;
    if (svc && pdAfter?.pdResult === "positive") status = "pregnant";
    else if (svc && !pdAfter) status = "served";
    else if (isHeifer) status = "heifer";
    else if (lastCalving && daysBetween(lastCalving, today) < VOLUNTARY_WAIT_DAYS) status = "fresh";
    else status = "open";

    const expectedCalving = status === "pregnant" ? addDays(svc!.date, settings.gestationDays) : null;
    const daysOpen = lastCalving && status !== "pregnant" ? daysBetween(lastCalving, today) : null;

    // The next thing to do or watch for with this cow.
    let next: CowBreeding["next"] = null;
    if (status === "pregnant") {
      const dry = addDays(expectedCalving!, -settings.dryOffDaysBeforeCalving);
      next = !dried && String(r.purpose) === "dairy" && dry <= addDays(today, 30) ? { type: "dry_off", date: dry } : { type: "calving", date: expectedCalving! };
    } else if (status === "served") {
      const ret = addDays(svc!.date, settings.heatCycleDays);
      next = ret >= addDays(today, -3) ? { type: "heat_watch", date: ret } : { type: "pd_due", date: addDays(svc!.date, settings.pregnancyCheckDays) };
    } else if (status === "fresh") {
      next = { type: "ready_to_serve", date: addDays(lastCalving!, VOLUNTARY_WAIT_DAYS) };
    } else if (status === "open" || status === "heifer") {
      if (daysOpen !== null && daysOpen > OPEN_TOO_LONG_DAYS) next = { type: "open_long", date: today };
      else if (lastHeat) {
        // Project the heat cycle forward to the next expected heat.
        let h = lastHeat;
        while (h < today) h = addDays(h, settings.heatCycleDays);
        next = { type: "heat_watch", date: h };
      }
    }

    return {
      id,
      tag: String(r.tag),
      name: (r.name as string | null) ?? null,
      nameBn: (r.name_bn as string | null) ?? null,
      purpose: String(r.purpose),
      status,
      lastCalving,
      lastHeat,
      lastService: svc ? { date: svc.date, sire: svc.sire, method: svc.method } : null,
      services: since.filter((e) => e.type === "service").length,
      daysOpen,
      expectedCalving,
      dried,
      next,
    };
  });

  return { today, cows };
}

/**
 * Each service with its outcome: "positive" if the next pregnancy check before any repeat service
 * was positive; "negative" if that check was negative or the cow was served again (she came back
 * into heat); null while it's too early to tell.
 */
const serviceOutcomes = (farmId: string) => sql`
  select b.id, b.animal_id, b.date, b.sire_id, b.sire_animal_id,
    case
      when pd.pd_result = 'positive' then 'positive'
      when pd.pd_result = 'negative' or nxt.date is not null then 'negative'
    end as result
  from breeding_events b
  left join lateral (
    select min(s2.date) as date from breeding_events s2
    where s2.animal_id = b.animal_id and s2.type = 'service' and s2.date > b.date
  ) nxt on true
  left join lateral (
    select p.pd_result::text as pd_result from breeding_events p
    where p.animal_id = b.animal_id and p.type = 'pregnancy_check' and p.date > b.date
      and (nxt.date is null or p.date < nxt.date)
    order by p.date limit 1
  ) pd on true
  where b.farm_id = ${farmId} and b.type = 'service'
`;

/** Herd fertility numbers over the last 12 months. */
export async function fertilityKpis(db: DB, farmId: string) {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    with svc as (
      select * from (${serviceOutcomes(farmId)}) o where o.date > ${today}::date - 365
    ),
    calvings as (
      select animal_id, date, lag(date) over (partition by animal_id order by date) as prev
      from breeding_events where farm_id = ${farmId} and type = 'calving'
    ),
    first_service as (
      select c.animal_id, c.date as calved,
        (select min(s.date) from breeding_events s where s.animal_id = c.animal_id and s.type = 'service' and s.date > c.date) as served
      from breeding_events c
      where c.farm_id = ${farmId} and c.type = 'calving' and c.date > ${today}::date - 540
    )
    select
      (select count(*) from svc where result is not null)::int as checked,
      (select count(*) from svc where result = 'positive')::int as conceived,
      (select round(avg(date - prev)) from calvings where prev is not null and date > ${today}::date - 730)::int as calving_interval,
      (select round(avg(served - calved)) from first_service where served is not null)::int as days_to_first_service
  `);
  const r = rowsOf<Record<string, unknown>>(res)[0] ?? {};
  const checked = Number(r.checked ?? 0);
  const conceived = Number(r.conceived ?? 0);
  return {
    conceptionRate: checked ? conceived / checked : null,
    servicesPerConception: conceived ? checked / conceived : null,
    calvingInterval: r.calving_interval === null || r.calving_interval === undefined ? null : Number(r.calving_interval),
    daysToFirstService: r.days_to_first_service === null || r.days_to_first_service === undefined ? null : Number(r.days_to_first_service),
    checked,
  };
}

export type SireRow = {
  key: string;
  kind: "straw" | "bull";
  code: string;
  name: string | null;
  breed: string | null;
  source: string | null;
  services: number;
  checked: number;
  conceived: number;
  calves: number;
};

/** AI straws and the farm's own bulls, with how their services turned out. */
export async function sireCatalog(db: DB, farmId: string): Promise<SireRow[]> {
  const res = await db.execute(sql`
    with svc as (${serviceOutcomes(farmId)})
    select 'straw' as kind, s.id as key, s.code, s.name, s.breed_label as breed, s.source,
      count(svc.*)::int as services,
      count(svc.result)::int as checked,
      count(*) filter (where svc.result = 'positive')::int as conceived,
      (select count(*) from animals c where c.sire_id = s.id)::int as calves
    from sires s left join svc on svc.sire_id = s.id
    where s.farm_id = ${farmId}
    group by s.id
    union all
    select 'bull', a.id, a.tag, a.name, a.breed_label, null,
      count(svc.*)::int, count(svc.result)::int,
      count(*) filter (where svc.result = 'positive')::int,
      (select count(*) from animals c where c.sire_animal_id = a.id)::int
    from animals a left join svc on svc.sire_animal_id = a.id
    where a.farm_id = ${farmId} and a.purpose = 'breeding' and a.sex = 'male' and a.lifecycle = 'active'
    group by a.id
    order by services desc, code
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    key: String(r.key),
    kind: r.kind === "bull" ? "bull" : "straw",
    code: String(r.code),
    name: (r.name as string | null) ?? null,
    breed: (r.breed as string | null) ?? null,
    source: (r.source as string | null) ?? null,
    services: Number(r.services ?? 0),
    checked: Number(r.checked ?? 0),
    conceived: Number(r.conceived ?? 0),
    calves: Number(r.calves ?? 0),
  }));
}

/* ───────────────────────── Inbreeding check ───────────────────────── */

export type Relation = "sire" | "grandsire" | "son" | "grandson" | "half_sibling" | "full_sibling" | "same_straw_as_sire";

/**
 * Close relations between a cow and a proposed sire, from the farm's records. It can only see what's
 * recorded, so silence isn't proof; but it catches the common mistake of using a cow's own father,
 * son or brother, or a straw from the same bull that sired her.
 */
export async function inbreedingCheck(
  db: DB,
  farmId: string,
  cowId: string,
  sire: { animalId?: string | null; sireId?: string | null },
): Promise<Relation[]> {
  const res = await db.execute(sql`
    select a.id, a.dam_id, a.sire_id, a.sire_animal_id,
      d.sire_id as dam_sire_id, d.sire_animal_id as dam_sire_animal_id,
      sa.sire_id as sire_sire_id, sa.sire_animal_id as sire_sire_animal_id
    from animals a
    left join animals d on d.id = a.dam_id
    left join animals sa on sa.id = a.sire_animal_id
    where a.farm_id = ${farmId} and a.id = ${cowId}
  `);
  const cow = rowsOf<Record<string, string | null>>(res)[0];
  if (!cow) return [];
  const out = new Set<Relation>();

  if (sire.sireId) {
    if (cow.sire_id === sire.sireId) out.add("same_straw_as_sire");
    if (cow.dam_sire_id === sire.sireId || cow.sire_sire_id === sire.sireId) out.add("grandsire");
  }
  if (sire.animalId) {
    const b = sire.animalId;
    if (cow.sire_animal_id === b) out.add("sire");
    if (cow.dam_sire_animal_id === b || cow.sire_sire_animal_id === b) out.add("grandsire");
    const bullRes = await db.execute(sql`
      select a.dam_id, a.sire_id, a.sire_animal_id, d.dam_id as dam_dam_id
      from animals a left join animals d on d.id = a.dam_id where a.id = ${b}
    `);
    const bull = rowsOf<Record<string, string | null>>(bullRes)[0];
    if (bull) {
      if (bull.dam_id === cow.id) out.add("son");
      if (bull.dam_dam_id === cow.id) out.add("grandson");
      const sameDam = bull.dam_id && bull.dam_id === cow.dam_id;
      const sameSire =
        (bull.sire_animal_id && bull.sire_animal_id === cow.sire_animal_id) || (bull.sire_id && bull.sire_id === cow.sire_id);
      if (sameDam && sameSire) out.add("full_sibling");
      else if (sameDam || sameSire) out.add("half_sibling");
    }
  }
  return [...out];
}

/* ───────────────────────── Recording ───────────────────────── */

export const EVENT_TYPES = ["heat", "service", "pregnancy_check", "calving", "abortion", "dry_off"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const eventInput = z.object({
  tag: z.string().trim().min(1, "required").max(20),
  type: z.enum(EVENT_TYPES),
  date: z.string().regex(isoDay, "date"),
  method: z.enum(["ai", "natural"]).optional(),
  /** AI straw code or a farm bull's tag */
  sire: optText(30),
  technician: optText(80),
  pdResult: z.enum(["positive", "negative", "uncertain"]).optional(),
  calvingEase: z.enum(["normal", "assisted", "difficult", "caesarean"]).optional(),
  calfTag: optText(20),
  calfSex: z.enum(["female", "male"]).optional(),
  calfName: optText(60),
  notes: optText(500),
  /** Set when the person has seen the inbreeding warning and goes ahead anyway. */
  acceptRelation: z.string().optional(),
});
export type EventInput = z.input<typeof eventInput>;

export async function recordBreedingEvent(db: DB, actor: Actor, input: EventInput, today: string) {
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  const perm = v.type === "heat" ? "breeding.observe" : "breeding.record";
  if (!can(actor.role, perm)) return err("forbidden" as const);
  if (v.date > today) return { ...err("invalid" as const), fields: { date: "future" } };

  const [cow] = await db
    .select({ id: animals.id, tag: animals.tag, sex: animals.sex, birthDate: animals.birthDate, breedLabel: animals.breedLabel, shedId: animals.shedId })
    .from(animals)
    .where(and(eq(animals.farmId, actor.farmId), eq(animals.lifecycle, "active"), sql`upper(${animals.tag}) = upper(${v.tag})`))
    .limit(1);
  if (!cow) return { ...err("invalid" as const), fields: { tag: "not_found" } };
  if (cow.sex !== "female") return { ...err("invalid" as const), fields: { tag: "not_female" } };
  if (cow.birthDate && v.date < cow.birthDate) return { ...err("invalid" as const), fields: { date: "before_birth" } };

  let sireId: string | null = null;
  let sireAnimalId: string | null = null;
  if (v.type === "service") {
    if (!v.method) return { ...err("invalid" as const), fields: { method: "required" } };
    if (!v.sire) return { ...err("invalid" as const), fields: { sire: "required" } };
    if (v.method === "ai") {
      const [straw] = await db
        .select({ id: sires.id })
        .from(sires)
        .where(and(eq(sires.farmId, actor.farmId), sql`upper(${sires.code}) = upper(${v.sire})`))
        .limit(1);
      sireId =
        straw?.id ??
        (
          await db
            .insert(sires)
            .values({ farmId: actor.farmId, code: v.sire.toUpperCase() })
            .returning({ id: sires.id })
        )[0]!.id;
    } else {
      const [bull] = await db
        .select({ id: animals.id, sex: animals.sex })
        .from(animals)
        .where(and(eq(animals.farmId, actor.farmId), sql`upper(${animals.tag}) = upper(${v.sire})`))
        .limit(1);
      if (!bull || bull.sex !== "male") return { ...err("invalid" as const), fields: { sire: "not_bull" } };
      sireAnimalId = bull.id;
    }
    const relations = await inbreedingCheck(db, actor.farmId, cow.id, { animalId: sireAnimalId, sireId });
    if (relations.length && v.acceptRelation !== "yes") return { ...err("related" as const), relations };
  }
  if (v.type === "pregnancy_check" && !v.pdResult) return { ...err("invalid" as const), fields: { pdResult: "required" } };

  // Calving: the calf gets its own record, linked to its mother and to the sire of the last service.
  let calfId: string | null = null;
  if (v.type === "calving") {
    if (!v.calfTag) return { ...err("invalid" as const), fields: { calfTag: "required" } };
    if (!v.calfSex) return { ...err("invalid" as const), fields: { calfSex: "required" } };
    const [taken] = await db
      .select({ id: animals.id })
      .from(animals)
      .where(and(eq(animals.farmId, actor.farmId), sql`upper(${animals.tag}) = upper(${v.calfTag})`))
      .limit(1);
    if (taken) return { ...err("invalid" as const), fields: { calfTag: "taken" } };
    const [svc] = await db
      .select({ sireId: breedingEvents.sireId, sireAnimalId: breedingEvents.sireAnimalId })
      .from(breedingEvents)
      .where(and(eq(breedingEvents.animalId, cow.id), eq(breedingEvents.type, "service"), sql`${breedingEvents.date} < ${v.date}`))
      .orderBy(sql`${breedingEvents.date} desc`)
      .limit(1);
    const [calf] = await db
      .insert(animals)
      .values({
        farmId: actor.farmId,
        tag: v.calfTag.toUpperCase(),
        name: v.calfName,
        sex: v.calfSex,
        birthDate: v.date,
        origin: "born",
        purpose: "calf",
        damId: cow.id,
        sireId: svc?.sireId ?? null,
        sireAnimalId: svc?.sireAnimalId ?? null,
        breedLabel: cow.breedLabel,
        shedId: cow.shedId,
      })
      .returning({ id: animals.id });
    calfId = calf!.id;
  }

  const [row] = await db
    .insert(breedingEvents)
    .values({
      farmId: actor.farmId,
      animalId: cow.id,
      type: v.type,
      date: v.date,
      method: v.type === "service" ? v.method : null,
      sireId,
      sireAnimalId,
      technician: v.technician,
      pdResult: v.type === "pregnancy_check" ? v.pdResult : null,
      calvingEase: v.type === "calving" ? (v.calvingEase ?? "normal") : null,
      calfId,
      notes: v.notes,
      recordedById: actor.userId,
    })
    .returning({ id: breedingEvents.id });
  await audit(db, actor, `breeding.${v.type}`, "breeding_event", row!.id, { tag: cow.tag, calfTag: v.calfTag ?? undefined });
  return ok({ tag: cow.tag, calfTag: v.type === "calving" ? v.calfTag!.toUpperCase() : null });
}

/** Options for the sire field: the farm's straws and its own active bulls. */
export async function sireOptions(db: DB, farmId: string) {
  const straws = await db.select({ code: sires.code, breed: sires.breedLabel }).from(sires).where(eq(sires.farmId, farmId)).orderBy(sires.code);
  const bulls = await db
    .select({ code: animals.tag, name: animals.name, breed: animals.breedLabel })
    .from(animals)
    .where(and(eq(animals.farmId, farmId), eq(animals.purpose, "breeding"), eq(animals.sex, "male"), eq(animals.lifecycle, "active")))
    .orderBy(animals.tag);
  return { straws, bulls };
}
