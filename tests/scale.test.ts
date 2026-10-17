import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { DEFAULT_FARM_SETTINGS, users } from "@/db/schema";
import { listAnimals } from "@/server/animals";
import { createFarm } from "@/server/farms";
import { getHerdSummary } from "@/server/herd";
import { overview } from "@/server/overview";
import { fatteningBoard } from "@/server/qurbani";

/** Time one call; returns its result and how long it took in ms. */
async function timed<T>(fn: () => Promise<T>) {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - t0 };
}

describe("farms of every size", () => {
  let db: DB;
  let small: string;
  let big: string;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const [a, b] = await db.insert(users).values([{ phone: "+8801911000001" }, { phone: "+8801911000002" }]).returning();
    small = (await createFarm(db, a!.id, { ownerName: "Abdul Karim", name: "Karim's cows", district: "Bogura", segments: ["dairy"] })).id;
    big = (await createFarm(db, b!.id, { ownerName: "Big Farm Ltd", name: "Big Farm", district: "Sirajganj", segments: ["dairy", "breeding", "qurbani"] })).id;

    // Two cows, a week of milk.
    await db.execute(sql`insert into animals (farm_id, tag, name, sex, origin, purpose)
      values (${small}, '1', 'Lali', 'female', 'born', 'dairy'), (${small}, '2', 'Dholi', 'female', 'purchased', 'dairy')`);
    await db.execute(sql`insert into milk_records (farm_id, animal_id, date, session, litres)
      select a.farm_id, a.id, current_date - d, 'am', 4 + (d % 3) from animals a, generate_series(0, 6) d where a.farm_id = ${small}`);

    // 1,000 animals: 700 cows, 250 Qurbani bulls, 50 calves; 30 days of milk twice a day for the cows; three weigh-ins per bull.
    await db.execute(sql`insert into animals (farm_id, tag, sex, origin, purpose, birth_date)
      select ${big}, 'C-' || lpad(i::text, 4, '0'), 'female', 'born', 'dairy', current_date - (900 + i) from generate_series(1, 700) i`);
    await db.execute(sql`insert into animals (farm_id, tag, sex, origin, purpose, birth_date)
      select ${big}, 'Q-' || lpad(i::text, 4, '0'), 'male', 'purchased', 'qurbani', current_date - (600 + i) from generate_series(1, 250) i`);
    await db.execute(sql`insert into animals (farm_id, tag, sex, origin, purpose, birth_date)
      select ${big}, 'K-' || lpad(i::text, 4, '0'), case when i % 2 = 0 then 'male'::sex else 'female'::sex end, 'born', 'calf', current_date - i from generate_series(1, 50) i`);
    await db.execute(sql`insert into milk_records (farm_id, animal_id, date, session, litres)
      select a.farm_id, a.id, current_date - d, s::milk_session, 4 + (abs(hashtext(a.tag || d || s)) % 60) / 10.0
      from animals a, generate_series(0, 29) d, unnest(array['am', 'pm']) s where a.farm_id = ${big} and a.purpose = 'dairy'`);
    await db.execute(sql`insert into weigh_ins (farm_id, animal_id, date, weight_kg, method)
      select a.farm_id, a.id, current_date - d, 250 + d, 'scale'
      from animals a, unnest(array[60, 30, 1]) d where a.farm_id = ${big} and a.purpose = 'qurbani'`);
    await db.execute(sql`analyze`);
  }, 240_000);

  it("a farm with two cows gets a calm, correct overview", async () => {
    const herd = await getHerdSummary(db, small);
    expect(herd.milkCows).toBe(2);
    const ov = await overview(db, small, "owner", DEFAULT_FARM_SETTINGS);
    expect(ov.dairy?.daily.some((d) => d.cows === 2)).toBe(true);
    expect(ov.items.every((i) => i.count >= 0)).toBe(true);
    const list = await listAnimals(db, small, { group: "all", sort: "tag", page: 1 });
    expect(list.items.map((r) => r.tag)).toEqual(["1", "2"]);
  });

  it("a farm with 1,000 animals stays quick: pages of animals, the overview, the Qurbani board", async () => {
    const herd = await timed(() => getHerdSummary(db, big));
    expect(herd.value.milkCows).toBe(700);
    const list = await timed(() => listAnimals(db, big, { group: "all", sort: "milk", page: 3 }));
    expect(list.value.items.length).toBe(24);
    expect(list.value.total).toBe(1000);
    const ov = await timed(() => overview(db, big, "owner", DEFAULT_FARM_SETTINGS));
    expect(ov.value.dairy?.daily.at(-1)?.cows).toBe(700);
    const board = await timed(() => fatteningBoard(db, big));
    expect(board.value.bulls.length).toBe(250);
    // In-memory PGlite is far slower than Postgres on a server; these ceilings are generous on purpose.
    console.info(`1,000 animals: herd ${herd.ms | 0} ms, list ${list.ms | 0} ms, overview ${ov.ms | 0} ms, Qurbani board ${board.ms | 0} ms`);
    for (const t of [herd, list, ov, board]) expect(t.ms).toBeLessThan(8_000);
  }, 120_000);
});
