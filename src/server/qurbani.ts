import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { animals, weighIns } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok } from "@/lib/result";
import { audit, daysBetween, isoDay, refDay, zodFields, type Actor } from "./common";

const n0 = (v: unknown) => num(v) ?? 0;

/**
 * Live weight from a tape: Schaeffer's formula, lb = girth² × length / 300 (inches), which in
 * centimetres and kilograms is girth² × length / 10 838. Good to about ±5–10% on cattle in fair
 * condition; a scale is better when there is one.
 */
export function tapeWeightKg(girthCm: number, lengthCm: number) {
  return Math.round(((girthCm * girthCm * lengthCm) / 10_838) * 2) / 2;
}

export type EidInfo = { date: string; confirmed: boolean; year: number } | null;

export async function nextEid(db: DB, today: string): Promise<EidInfo> {
  const res = await db.execute(sql`select key, value from platform_settings where key like 'eid_ul_adha:%' order by key`);
  for (const r of rowsOf<{ key: string; value: unknown }>(res)) {
    const v = (typeof r.value === "string" ? JSON.parse(r.value) : r.value) as { date?: string; confirmed?: boolean };
    if (v?.date && v.date >= today) return { date: v.date, confirmed: Boolean(v.confirmed), year: Number(r.key.split(":")[1]) };
  }
  return null;
}

export type BullStatus = "ahead" | "on_track" | "behind" | "no_plan";

export type BullRow = {
  id: string;
  tag: string;
  name: string | null;
  breed: string | null;
  shed: string | null;
  photoUrl: string | null;
  purchaseDate: string | null;
  startKg: number | null;
  targetKg: number | null;
  pricePerKg: number | null;
  latestKg: number | null;
  latestDate: string | null;
  /** Average daily gain over the last ~30 days of weigh-ins (falls back to since purchase). */
  adg: number | null;
  projectedKg: number | null;
  status: BullStatus;
  staleDays: number | null;
  costTk: number;
  feedPerDayTk: number;
  expectedValueTk: number | null;
  projectedMarginTk: number | null;
  listed: boolean;
  meatWithdrawalUntil: string | null;
};

/** Exported for profiling. */
export const boardSql = (farmId: string, eidYear: number) =>
  sql`
    with bulls as (
      select a.id, a.tag, a.name, a.breed_label, a.shed_id, a.purchase_date, a.purchase_price_tk, s.name as shed
      from animals a left join sheds s on s.id = a.shed_id
      where a.farm_id = ${farmId} and a.lifecycle = 'active' and a.purpose = 'qurbani'
    ),
    w as (
      select wi.animal_id, wi.date, wi.weight_kg::float as kg,
        row_number() over (partition by wi.animal_id order by wi.date desc) as rn
      from weigh_ins wi join bulls b on b.id = wi.animal_id
    ),
    latest as (select animal_id, date, kg from w where rn = 1),
    -- the weigh-in closest to 30 days before the latest, for a recent growth rate
    earlier as (
      select distinct on (w.animal_id) w.animal_id, w.date, w.kg
      from w join latest l on l.animal_id = w.animal_id
      where w.date <= l.date - 21
      order by w.animal_id, abs((l.date - w.date) - 30)
    ),
    first as (select distinct on (animal_id) animal_id, date, kg from w order by animal_id, date),
    -- feed is logged per shed: share each shed-day's cost among the bulls in it that day
    shedday as (
      select shed_id, date, sum(cost_tk)::float as cost from feed_logs
      where farm_id = ${farmId} and shed_id in (select shed_id from bulls) group by shed_id, date
    ),
    perhead as (
      select sd.shed_id, sd.date, sd.cost / count(b.id) as cost
      from shedday sd join bulls b on b.shed_id = sd.shed_id and coalesce(b.purchase_date, sd.date) <= sd.date
      group by sd.shed_id, sd.date, sd.cost
    ),
    feed as (
      select b.id, sum(ph.cost) as cost,
        sum(ph.cost) filter (where ph.date > (select max(date) from shedday) - 14) / 14 as per_day
      from bulls b
      join perhead ph on ph.shed_id = b.shed_id and ph.date >= coalesce(b.purchase_date, ph.date)
      group by b.id
    ),
    direct as (
      select animal_id, sum(amount_tk)::float as cost, bool_or(category = 'animal_purchase') as has_purchase
      from expenses where farm_id = ${farmId} and animal_id is not null group by animal_id
    ),
    health as (
      select animal_id, sum(cost_tk)::float as cost, max(meat_withdrawal_until) as meat_until
      from health_events where farm_id = ${farmId} group by animal_id
    ),
    photo as (
      select distinct on (animal_id) animal_id, url from animal_media where farm_id = ${farmId} order by animal_id, is_cover desc, created_at
    )
    select b.id, b.tag, b.name, b.breed_label, b.shed, b.purchase_date::text as purchase_date, ph.url as photo_url,
      coalesce(p.start_weight_kg::float, f.kg) as start_kg, p.target_weight_kg::float as target_kg, p.price_per_kg_tk as price_per_kg,
      l.kg as latest_kg, l.date::text as latest_date,
      case when e.animal_id is not null then (l.kg - e.kg) / nullif(l.date - e.date, 0)
           else (l.kg - f.kg) / nullif(l.date - f.date, 0) end as adg,
      coalesce(d.cost, 0) + case when coalesce(d.has_purchase, false) then 0 else coalesce(b.purchase_price_tk, 0) end
        + coalesce(fe.cost, 0) + coalesce(h.cost, 0) as cost,
      coalesce(fe.per_day, 0) as feed_per_day,
      h.meat_until::text as meat_until,
      exists (select 1 from listings li where li.animal_id = b.id and li.status = 'active') as listed
    from bulls b
    left join latest l on l.animal_id = b.id
    left join earlier e on e.animal_id = b.id
    left join first f on f.animal_id = b.id
    left join fattening_plans p on p.animal_id = b.id and p.season_year = ${eidYear}
    left join feed fe on fe.id = b.id
    left join direct d on d.animal_id = b.id
    left join health h on h.animal_id = b.id
    left join photo ph on ph.animal_id = b.id
    order by b.tag
  `;

export async function fatteningBoard(db: DB, farmId: string) {
  const today = await refDay(db, farmId);
  const eid = await nextEid(db, today);
  const res = await db.execute(boardSql(farmId, eid?.year ?? 0));

  const daysToEid = eid ? Math.max(0, daysBetween(today, eid.date)) : null;
  const bulls: BullRow[] = rowsOf<Record<string, unknown>>(res).map((r) => {
    const latestKg = num(r.latest_kg);
    const latestDate = isoDate(r.latest_date);
    const adg = r.adg === null || r.adg === undefined ? null : Math.round(Number(r.adg) * 100) / 100;
    const targetKg = num(r.target_kg);
    const pricePerKg = num(r.price_per_kg);
    const projectedKg = latestKg !== null && latestDate && adg !== null && eid ? Math.round(latestKg + adg * daysBetween(latestDate, eid.date)) : null;
    let status: BullStatus = "no_plan";
    if (targetKg && projectedKg) status = projectedKg >= targetKg * 1.05 ? "ahead" : projectedKg >= targetKg * 0.97 ? "on_track" : "behind";
    const cost = Math.round(n0(r.cost));
    const feedPerDay = Math.round(n0(r.feed_per_day));
    const expectedValue = projectedKg && pricePerKg ? projectedKg * pricePerKg : null;
    const meatUntil = isoDate(r.meat_until);
    return {
      id: String(r.id),
      tag: String(r.tag),
      name: (r.name as string | null) ?? null,
      breed: (r.breed_label as string | null) ?? null,
      shed: (r.shed as string | null) ?? null,
      photoUrl: (r.photo_url as string | null) ?? null,
      purchaseDate: isoDate(r.purchase_date),
      startKg: num(r.start_kg),
      targetKg,
      pricePerKg,
      latestKg,
      latestDate,
      adg,
      projectedKg,
      status,
      staleDays: latestDate ? daysBetween(latestDate, today) : null,
      costTk: cost,
      feedPerDayTk: feedPerDay,
      expectedValueTk: expectedValue,
      projectedMarginTk: expectedValue !== null && daysToEid !== null ? Math.round(expectedValue - cost - feedPerDay * daysToEid) : null,
      listed: Boolean(r.listed),
      meatWithdrawalUntil: meatUntil && meatUntil >= today ? meatUntil : null,
    };
  });
  return { today, eid, daysToEid, bulls };
}

/* ───────────────────────── Weigh-ins ───────────────────────── */

export const WEIGH_GROUPS = ["qurbani", "calf", "breeding"] as const;
export type WeighGroup = (typeof WEIGH_GROUPS)[number];

export async function weighSheet(db: DB, farmId: string, group: WeighGroup, date: string) {
  const res = await db.execute(sql`
    select a.id, a.tag, a.name, s.name as shed,
      (select json_build_object('kg', w.weight_kg::float, 'date', w.date::text) from weigh_ins w
        where w.animal_id = a.id and w.date < ${date}::date order by w.date desc limit 1) as last,
      (select json_build_object('kg', w.weight_kg::float, 'method', w.method::text, 'girth', w.heart_girth_cm::float, 'length', w.body_length_cm::float)
        from weigh_ins w where w.animal_id = a.id and w.date = ${date}::date order by w.created_at desc limit 1) as today
    from animals a left join sheds s on s.id = a.shed_id
    where a.farm_id = ${farmId} and a.lifecycle = 'active' and a.purpose = ${group}::purpose
    order by s.name nulls last, a.tag
  `);
  const parse = <T,>(v: unknown) => (v === null || v === undefined ? null : ((typeof v === "string" ? JSON.parse(v) : v) as T));
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    tag: String(r.tag),
    name: (r.name as string | null) ?? null,
    shed: (r.shed as string | null) ?? null,
    last: parse<{ kg: number; date: string }>(r.last),
    today: parse<{ kg: number; method: "scale" | "tape"; girth: number | null; length: number | null }>(r.today),
  }));
}

const weighInput = z.object({
  date: z.string().regex(isoDay, "date"),
  entries: z
    .array(
      z.object({
        animalId: z.string().uuid(),
        method: z.enum(["scale", "tape"]),
        kg: z.number().min(10).max(1500).optional(),
        girthCm: z.number().min(40).max(300).optional(),
        lengthCm: z.number().min(40).max(300).optional(),
      }),
    )
    .min(1, "empty")
    .max(1000),
});
export type WeighInput = z.input<typeof weighInput>;

/** Saves a weighing day. One weigh-in per animal per day: re-saving replaces it. */
export async function saveWeighIns(db: DB, actor: Actor, input: WeighInput, today: string) {
  if (!can(actor.role, "weight.record")) return err("forbidden" as const);
  const parsed = weighInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const { date, entries } = parsed.data;
  if (date > today) return { ...err("invalid" as const), fields: { date: "future" } };

  const rows: (typeof weighIns.$inferInsert)[] = [];
  const bad: string[] = [];
  for (const e of entries) {
    const kg = e.method === "tape" ? (e.girthCm && e.lengthCm ? tapeWeightKg(e.girthCm, e.lengthCm) : null) : (e.kg ?? null);
    if (!kg || kg < 10 || kg > 1500) {
      bad.push(e.animalId);
      continue;
    }
    rows.push({
      farmId: actor.farmId,
      animalId: e.animalId,
      date,
      weightKg: kg.toFixed(1),
      method: e.method,
      heartGirthCm: e.method === "tape" ? e.girthCm!.toFixed(1) : null,
      bodyLengthCm: e.method === "tape" ? e.lengthCm!.toFixed(1) : null,
      recordedById: actor.userId,
    });
  }
  if (bad.length) return { ...err("invalid" as const), fields: { entries: "range" }, bad };
  const owned = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.farmId, actor.farmId), inArray(animals.id, rows.map((r) => r.animalId))));
  const ownedIds = new Set(owned.map((o) => o.id));
  const mine = rows.filter((r) => ownedIds.has(r.animalId));
  if (mine.length === 0) return { ...err("invalid" as const), fields: { entries: "empty" } };
  await db.delete(weighIns).where(and(eq(weighIns.farmId, actor.farmId), eq(weighIns.date, date), inArray(weighIns.animalId, mine.map((r) => r.animalId))));
  await db.insert(weighIns).values(mine);
  await audit(db, actor, "weight.record", "weigh_day", date, { count: mine.length });
  return ok({ count: mine.length });
}

