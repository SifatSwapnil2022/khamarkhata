import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";

/** Drivers return either an array of rows or `{ rows }`. */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export type HerdSummary = {
  milkCows: number;
  milkingCows: number;
  dryCows: number;
  heiferCalves: number;
  bullCalves: number;
  qurbaniBulls: number;
  breedingBulls: number;
  latestMilkDate: string | null;
  latestMilkLitres: number;
  pregnant: number;
  inHeatOnLatestDay: number;
  underMilkWithdrawal: number;
  fmdOverdue: number;
  qurbaniAvgKg: number | null;
};

/** One round trip for the overview cards. Dates are relative to the farm's latest milk record. */
export async function getHerdSummary(db: DB, farmId: string): Promise<HerdSummary> {
  const res = await db.execute(sql`
    with
      active as (select * from animals where farm_id = ${farmId} and lifecycle = 'active'),
      latest as (select max(date) as d from milk_records where farm_id = ${farmId}),
      milking as (
        select distinct m.animal_id from milk_records m, latest
        where m.farm_id = ${farmId} and m.date = latest.d
      ),
      preg as (
        select distinct p.animal_id from breeding_events p
        where p.farm_id = ${farmId} and p.type = 'pregnancy_check' and p.pd_result = 'positive'
          and not exists (
            select 1 from breeding_events c
            where c.animal_id = p.animal_id and c.type = 'calving' and c.date > p.date
          )
      ),
      fmd as (
        select distinct on (h.animal_id) h.animal_id, h.next_due_date
        from health_events h join vaccines v on v.id = h.vaccine_id
        where h.farm_id = ${farmId} and v.name = 'FMD'
        order by h.animal_id, h.date desc
      ),
      lastweigh as (
        select distinct on (w.animal_id) w.animal_id, w.weight_kg
        from weigh_ins w where w.farm_id = ${farmId}
        order by w.animal_id, w.date desc
      )
    select
      (select count(*) from active where purpose = 'dairy')::int as milk_cows,
      (select count(*) from milking)::int as milking_cows,
      (select count(*) from active a where purpose = 'dairy' and a.id not in (select animal_id from milking))::int as dry_cows,
      (select count(*) from active where purpose = 'calf' and sex = 'female')::int as heifer_calves,
      (select count(*) from active where purpose = 'calf' and sex = 'male')::int as bull_calves,
      (select count(*) from active where purpose = 'qurbani')::int as qurbani_bulls,
      (select count(*) from active where purpose = 'breeding')::int as breeding_bulls,
      (select d::text from latest) as latest_milk_date,
      coalesce((select sum(m.litres) from milk_records m, latest where m.farm_id = ${farmId} and m.date = latest.d), 0)::float as latest_milk_litres,
      (select count(*) from preg)::int as pregnant,
      (select count(*) from breeding_events b, latest where b.farm_id = ${farmId} and b.type = 'heat' and b.date = latest.d)::int as in_heat,
      (select count(distinct h.animal_id) from health_events h, latest
         where h.farm_id = ${farmId} and h.milk_withdrawal_until >= latest.d)::int as withdrawal,
      (select count(*) from fmd, latest where fmd.next_due_date < coalesce(latest.d, current_date))::int as fmd_overdue,
      (select round(avg(l.weight_kg)) from lastweigh l join active a on a.id = l.animal_id where a.purpose = 'qurbani')::float as qurbani_avg_kg
  `);
  const r = rowsOf<Record<string, unknown>>(res)[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    milkCows: n("milk_cows"),
    milkingCows: n("milking_cows"),
    dryCows: n("dry_cows"),
    heiferCalves: n("heifer_calves"),
    bullCalves: n("bull_calves"),
    qurbaniBulls: n("qurbani_bulls"),
    breedingBulls: n("breeding_bulls"),
    latestMilkDate: (r.latest_milk_date as string | null) ?? null,
    latestMilkLitres: Math.round(n("latest_milk_litres")),
    pregnant: n("pregnant"),
    inHeatOnLatestDay: n("in_heat"),
    underMilkWithdrawal: n("withdrawal"),
    fmdOverdue: n("fmd_overdue"),
    qurbaniAvgKg: r.qurbani_avg_kg == null ? null : Number(r.qurbani_avg_kg),
  };
}

export const herdIsEmpty = (h: HerdSummary) => h.milkCows + h.heiferCalves + h.bullCalves + h.qurbaniBulls + h.breedingBulls === 0;
