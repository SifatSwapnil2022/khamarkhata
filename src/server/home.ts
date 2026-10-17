import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { refDay } from "./common";
import { getHerdSummary } from "./herd";
import { searchListings } from "./market";
import { fatteningBoard } from "./qurbani";

export type HomeCow = { tag: string; name: string | null; nameBn: string | null; litres: number };
export type HomeBull = { tag: string; name: string | null; kg: number; projectedKg: number; targetKg: number };
export type HomeData = {
  farm: { name: string; district: string; upazila: string | null } | null;
  day: string | null;
  totals: { milkCows: number; litres: number; pregnant: number; calves: number; bulls: number; animals: number } | null;
  cows: HomeCow[];
  family: { dam: string; damName: string | null; calf: string; calfBorn: string; sire: string | null; sireBreed: string | null } | null;
  bulls: HomeBull[];
  eid: { date: string; days: number } | null;
  listings: Awaited<ReturnType<typeof searchListings>>["items"];
};

/**
 * Real numbers for the home page, read from the demo farm. The 3D scene puts them on ear tags,
 * so what a visitor sees floating over a cow is that cow's actual record.
 */
export async function getHomeData(db: DB): Promise<HomeData> {
  const farmRow = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select id, name, district, upazila from farms where name like '%(demo)' order by created_at limit 1`),
  )[0];
  const listings = (await searchListings(db, { sort: "newest", page: 1 })).items;
  if (!farmRow) return { farm: null, day: null, totals: null, cows: [], family: null, bulls: [], eid: null, listings };
  const farmId = String(farmRow.id);
  const day = await refDay(db, farmId);

  const [herd, cowRes, familyRes, board] = await Promise.all([
    getHerdSummary(db, farmId),
    db.execute(sql`
      select a.tag, a.name, a.name_bn, sum(m.litres)::float as litres
      from milk_records m join animals a on a.id = m.animal_id
      where m.farm_id = ${farmId} and m.date = ${day}::date and a.lifecycle = 'active'
      group by a.id order by litres desc limit 7
    `),
    db.execute(sql`
      select d.tag as dam, d.name as dam_name, c.tag as calf, c.birth_date::text as born,
        coalesce(s.code, sa.tag) as sire, coalesce(s.breed_label, sa.breed_label) as sire_breed
      from animals c join animals d on d.id = c.dam_id
      left join sires s on s.id = c.sire_id left join animals sa on sa.id = c.sire_animal_id
      where c.farm_id = ${farmId} and c.purpose = 'calf' and c.lifecycle = 'active' and d.lifecycle = 'active' and d.name is not null
      order by c.birth_date desc limit 1
    `),
    fatteningBoard(db, farmId),
  ]);
  const fam = rowsOf<Record<string, unknown>>(familyRes)[0];
  const bulls = board.bulls
    .filter((b) => b.latestKg && b.projectedKg && b.targetKg && b.status !== "behind")
    .sort((a, b) => (b.projectedKg ?? 0) - (a.projectedKg ?? 0))
    .slice(0, 5)
    .map((b) => ({ tag: b.tag, name: b.name, kg: b.latestKg!, projectedKg: b.projectedKg!, targetKg: b.targetKg! }));

  return {
    farm: { name: String(farmRow.name).replace(/\s*\(demo\)$/i, ""), district: String(farmRow.district), upazila: (farmRow.upazila as string | null) ?? null },
    day,
    totals: {
      milkCows: herd.milkCows,
      litres: herd.latestMilkLitres,
      pregnant: herd.pregnant,
      calves: herd.heiferCalves + herd.bullCalves,
      bulls: herd.qurbaniBulls,
      animals: herd.milkCows + herd.heiferCalves + herd.bullCalves + herd.qurbaniBulls + herd.breedingBulls,
    },
    cows: rowsOf<Record<string, unknown>>(cowRes).map((r) => ({
      tag: String(r.tag),
      name: (r.name as string | null) ?? null,
      nameBn: (r.name_bn as string | null) ?? null,
      litres: Math.round((num(r.litres) ?? 0) * 10) / 10,
    })),
    family: fam
      ? {
          dam: String(fam.dam),
          damName: (fam.dam_name as string | null) ?? null,
          calf: String(fam.calf),
          calfBorn: isoDate(fam.born) ?? "",
          sire: (fam.sire as string | null) ?? null,
          sireBreed: (fam.sire_breed as string | null) ?? null,
        }
      : null,
    bulls,
    eid: board.eid && board.daysToEid !== null ? { date: board.eid.date, days: board.daysToEid } : null,
    listings,
  };
}
