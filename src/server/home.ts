import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { refDay } from "./common";
import { getHerdSummary } from "./herd";
import { searchListings } from "./market";
import { fatteningBoard } from "./qurbani";

export type HomePhoto = { url: string; credit: string | null; sourceUrl: string | null };
export type HomeCow = { tag: string; name: string | null; nameBn: string | null; litres: number; photo: HomePhoto | null };
export type HomeBull = { tag: string; name: string | null; nameBn: string | null; kg: number; projectedKg: number; targetKg: number; photo: HomePhoto | null };
export type HomeData = {
  farm: { name: string; district: string; upazila: string | null } | null;
  day: string | null;
  totals: { milkCows: number; litres: number; pregnant: number; calves: number; bulls: number; animals: number } | null;
  cows: HomeCow[];
  family: { dam: string; damName: string | null; damNameBn: string | null; calf: string; calfBorn: string; sire: string | null; sireBreed: string | null; photo: HomePhoto | null } | null;
  bulls: HomeBull[];
  eid: { date: string; days: number } | null;
  listings: Awaited<ReturnType<typeof searchListings>>["items"];
  /** A listing with a photo, and that photo's credit, for the "sell" story. */
  sale: { listing: Awaited<ReturnType<typeof searchListings>>["items"][number]; photo: HomePhoto } | null;
};

/**
 * Real numbers for the home page, read from the demo farm. Each story on the page shows one animal's
 * photo next to that same animal's record, so the cow in the picture is the cow in the numbers.
 */
export async function getHomeData(db: DB): Promise<HomeData> {
  const farmRow = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select id, name, district, upazila from farms where name like '%(demo)' order by created_at limit 1`),
  )[0];
  const listings = (await searchListings(db, { sort: "newest", page: 1 })).items;
  const withPhoto = listings.find((l) => l.photoUrl && l.category !== "qurbani") ?? listings.find((l) => l.photoUrl);
  const saleCredit = withPhoto
    ? rowsOf<Record<string, unknown>>(await db.execute(sql`select credit, source_url from animal_media where url = ${withPhoto.photoUrl} limit 1`))[0]
    : undefined;
  const sale = withPhoto
    ? { listing: withPhoto, photo: { url: withPhoto.photoUrl!, credit: (saleCredit?.credit as string | null) ?? null, sourceUrl: (saleCredit?.source_url as string | null) ?? null } }
    : null;
  if (!farmRow) return { farm: null, day: null, totals: null, cows: [], family: null, bulls: [], eid: null, listings, sale };
  const farmId = String(farmRow.id);
  const day = await refDay(db, farmId);

  const [herd, cowRes, familyRes, board] = await Promise.all([
    getHerdSummary(db, farmId),
    db.execute(sql`
      select a.tag, a.name, a.name_bn, sum(m.litres)::float as litres,
        p.url as photo_url, p.credit as photo_credit, p.source_url as photo_source
      from milk_records m join animals a on a.id = m.animal_id
      left join lateral (select url, credit, source_url from animal_media x where x.animal_id = a.id order by is_cover desc, created_at limit 1) p on true
      where m.farm_id = ${farmId} and m.date = ${day}::date and a.lifecycle = 'active'
      group by a.id, p.url, p.credit, p.source_url
      order by (p.url is not null) desc, litres desc limit 7
    `),
    db.execute(sql`
      select d.tag as dam, d.name as dam_name, d.name_bn as dam_name_bn, c.tag as calf, c.birth_date::text as born,
        coalesce(s.code, sa.tag) as sire, coalesce(s.breed_label, sa.breed_label) as sire_breed,
        p.url as photo_url, p.credit as photo_credit, p.source_url as photo_source
      from animals c join animals d on d.id = c.dam_id
      left join sires s on s.id = c.sire_id left join animals sa on sa.id = c.sire_animal_id
      left join lateral (select url, credit, source_url from animal_media x where x.animal_id = d.id order by is_cover desc, created_at limit 1) p on true
      where c.farm_id = ${farmId} and c.purpose = 'calf' and c.lifecycle = 'active' and d.lifecycle = 'active' and d.name is not null
      order by (p.url is not null) desc, c.birth_date desc limit 1
    `),
    fatteningBoard(db, farmId),
  ]);
  const fam = rowsOf<Record<string, unknown>>(familyRes)[0];
  const ready = board.bulls
    .filter((b) => b.latestKg && b.projectedKg && b.targetKg && b.status !== "behind")
    .sort((a, b) => Number(Boolean(b.name)) - Number(Boolean(a.name)) || (b.projectedKg ?? 0) - (a.projectedKg ?? 0))
    .slice(0, 12);
  const bullPhotos = await photosFor(db, farmId, ready.map((b) => b.tag));
  const bulls = ready
    .map((b) => ({ tag: b.tag, name: b.name, nameBn: null as string | null, kg: b.latestKg!, projectedKg: b.projectedKg!, targetKg: b.targetKg!, photo: bullPhotos.get(b.tag)?.photo ?? null }))
    .map((b) => ({ ...b, nameBn: bullPhotos.get(b.tag)?.nameBn ?? null }))
    .sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)))
    .slice(0, 5);

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
      photo: photoOf(r),
    })),
    family: fam
      ? {
          dam: String(fam.dam),
          damName: (fam.dam_name as string | null) ?? null,
          calf: String(fam.calf),
          calfBorn: isoDate(fam.born) ?? "",
          sire: (fam.sire as string | null) ?? null,
          sireBreed: (fam.sire_breed as string | null) ?? null,
          damNameBn: (fam.dam_name_bn as string | null) ?? null,
          photo: photoOf(fam),
        }
      : null,
    bulls,
    eid: board.eid && board.daysToEid !== null ? { date: board.eid.date, days: board.daysToEid } : null,
    listings,
    sale,
  };
}

const photoOf = (r: Record<string, unknown>): HomePhoto | null =>
  r.photo_url ? { url: String(r.photo_url), credit: (r.photo_credit as string | null) ?? null, sourceUrl: (r.photo_source as string | null) ?? null } : null;

async function photosFor(db: DB, farmId: string, tags: string[]) {
  const out = new Map<string, { photo: HomePhoto | null; nameBn: string | null }>();
  if (!tags.length) return out;
  const res = await db.execute(sql`
    select a.tag, a.name_bn, p.url as photo_url, p.credit as photo_credit, p.source_url as photo_source
    from animals a
    left join lateral (select url, credit, source_url from animal_media x where x.animal_id = a.id order by is_cover desc, created_at limit 1) p on true
    where a.farm_id = ${farmId} and a.tag = any(${`{${tags.map((t) => `"${t.replace(/["\\]/g, "")}"`).join(",")}}`}::text[])
  `);
  for (const r of rowsOf<Record<string, unknown>>(res)) out.set(String(r.tag), { photo: photoOf(r), nameBn: (r.name_bn as string | null) ?? null });
  return out;
}
