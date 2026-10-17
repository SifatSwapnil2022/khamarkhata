import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import { users } from "@/db/schema";
import {
  createAnimal,
  getAnimalProfile,
  groupCounts,
  listAnimals,
  PAGE_SIZE,
  recordExit,
  updateAnimal,
} from "@/server/animals";
import { createFarm } from "@/server/farms";
import type { Actor } from "@/server/team";
import { testDb } from "./helpers";

describe("on the demo farm", () => {
  let db: DB;
  let farmId: string;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    farmId = rowsOf<{ id: string }>(await db.execute(sql`select id from farms where name like '%(demo)'`))[0]!.id;
  }, 120_000);

  it("counts each group", async () => {
    expect(await groupCounts(db, farmId)).toEqual({ all: 260, cows: 100, calves: 50, qurbani: 100, breeding: 10 });
  });

  it("pages the list and reports the total", async () => {
    const page1 = await listAnimals(db, farmId, { group: "all", sort: "tag", page: 1 });
    expect(page1.total).toBe(260);
    expect(page1.items).toHaveLength(PAGE_SIZE);
    const last = await listAnimals(db, farmId, { group: "all", sort: "tag", page: Math.ceil(260 / PAGE_SIZE) });
    expect(last.items.length).toBe(260 % PAGE_SIZE || PAGE_SIZE);
  });

  it("filters by status and search", async () => {
    const preg = await listAnimals(db, farmId, { group: "cows", status: "pregnant", sort: "tag", page: 1 });
    expect(preg.total).toBeGreaterThan(30);
    expect(preg.items.every((i) => i.pregnant && i.expectedCalving)).toBe(true);
    const dry = await listAnimals(db, farmId, { group: "cows", status: "dry", sort: "tag", page: 1 });
    expect(dry.total).toBe(14);
    const wd = await listAnimals(db, farmId, { group: "all", status: "withdrawal", sort: "tag", page: 1 });
    expect(wd.total).toBe(1);
    const q = await listAnimals(db, farmId, { group: "all", q: "q-00", sort: "tag", page: 1 });
    expect(q.items.every((i) => i.tag.startsWith("Q-00"))).toBe(true);
  });

  it("sorts cows by milk", async () => {
    const { items } = await listAnimals(db, farmId, { group: "cows", sort: "milk", page: 1 });
    const milk = items.map((i) => i.milkAvg ?? 0);
    expect([...milk].sort((a, b) => b - a)).toEqual(milk);
    expect(milk[0]).toBeGreaterThan(10);
  });

  it("builds a calf's profile with its mother", async () => {
    const calf = (await listAnimals(db, farmId, { group: "calves", sort: "tag", page: 1 })).items[0]!;
    const p = await getAnimalProfile(db, farmId, calf.tag);
    expect(p?.pedigree.dam.self?.kind).toBe("animal");
    expect(p?.pedigree.sire.self).not.toBeNull();
    expect(p?.weights.length).toBeGreaterThan(0);
  });

  it("builds a cow's profile with milk, breeding and vaccines", async () => {
    const cow = (await listAnimals(db, farmId, { group: "cows", status: "milking", sort: "milk", page: 1 })).items[0]!;
    const p = (await getAnimalProfile(db, farmId, cow.tag.toLowerCase()))!;
    expect(p.milk.length).toBeGreaterThan(10);
    expect(p.breeding.some((b) => b.type === "calving")).toBe(true);
    expect(p.vaccines.map((v) => v.vaccine)).toContain("FMD");
    // Not every demo cow has a photo (one real photo per animal, never shared); any she has is credited.
    expect(p.photos.every((ph) => /· (Unsplash|Pexels) ·/.test(ph.credit ?? ""))).toBe(true);
  });

  it("returns null for an unknown tag", async () => {
    expect(await getAnimalProfile(db, farmId, "ZZZ-999")).toBeNull();
  });
});

describe("create, edit and exit", () => {
  let db: DB;
  let owner: Actor;
  beforeEach(async () => {
    db = await testDb();
    const [u] = await db.insert(users).values({ phone: "+8801711111111", name: "Rahim" }).returning();
    const farm = await createFarm(db, u!.id, { ownerName: "Rahim", name: "Test farm", district: "Pabna", segments: ["dairy"] });
    owner = { userId: u!.id, farmId: farm.id, role: "owner" };
  });

  const cow = { tag: "d-1", sex: "female", purpose: "dairy", origin: "purchased", birthDate: "2020-01-01" } as const;

  it("creates with a normalized tag and rejects duplicates", async () => {
    expect(await createAnimal(db, owner, cow)).toMatchObject({ ok: true, value: { tag: "D-1" } });
    expect(await createAnimal(db, owner, { ...cow, tag: "D-1" })).toMatchObject({ ok: false, error: "tag_taken" });
  });

  it("checks sex against purpose", async () => {
    const res = await createAnimal(db, owner, { ...cow, sex: "male" });
    expect(res).toMatchObject({ ok: false, error: "invalid", fields: { sex: expect.any(String) } });
  });

  it("links a calf to its mother and refuses impossible parents", async () => {
    await createAnimal(db, owner, cow);
    await createAnimal(db, owner, { tag: "B-1", sex: "male", purpose: "breeding", origin: "purchased", birthDate: "2019-01-01" });
    const calf = await createAnimal(db, owner, {
      tag: "C-1", sex: "female", purpose: "calf", origin: "born", birthDate: "2026-05-01", damTag: "D-1", sireTag: "B-1",
    });
    expect(calf.ok).toBe(true);
    const p = (await getAnimalProfile(db, owner.farmId, "C-1"))!;
    expect(p.pedigree.dam.self).toMatchObject({ kind: "animal", tag: "D-1" });
    expect(p.pedigree.sire.self).toMatchObject({ kind: "animal", tag: "B-1" });

    const bullAsDam = await createAnimal(db, owner, { tag: "C-2", sex: "male", purpose: "calf", origin: "born", birthDate: "2026-05-01", damTag: "B-1" });
    expect(bullAsDam).toMatchObject({ fields: { damTag: "not_female" } });
    const youngerDam = await createAnimal(db, owner, { tag: "C-3", sex: "male", purpose: "calf", origin: "born", birthDate: "2018-01-01", damTag: "D-1" });
    expect(youngerDam).toMatchObject({ fields: { damTag: "too_young" } });
    const ghost = await createAnimal(db, owner, { tag: "C-4", sex: "male", purpose: "calf", origin: "born", sireTag: "NOPE" });
    expect(ghost).toMatchObject({ fields: { sireTag: "not_found" } });
  });

  it("can't be its own mother", async () => {
    await createAnimal(db, owner, cow);
    const id = rowsOf<{ id: string }>(await db.execute(sql`select id from animals where tag = 'D-1'`))[0]!.id;
    expect(await updateAnimal(db, owner, id, { ...cow, damTag: "D-1" })).toMatchObject({ fields: { damTag: "self" } });
  });

  it("workers can't create animals", async () => {
    expect(await createAnimal(db, { ...owner, role: "worker" }, cow)).toMatchObject({ error: "forbidden" });
  });

  it("records a sale and takes the animal out of the active herd", async () => {
    await createAnimal(db, owner, cow);
    const id = rowsOf<{ id: string }>(await db.execute(sql`select id from animals where tag = 'D-1'`))[0]!.id;
    expect(await recordExit(db, owner, id, { lifecycle: "sold", date: "2026-10-01" })).toMatchObject({ fields: { priceTk: expect.any(String) } });
    expect((await recordExit(db, owner, id, { lifecycle: "sold", date: "2026-10-01", priceTk: "120000", buyerName: "Neighbour" })).ok).toBe(true);
    expect((await groupCounts(db, owner.farmId)).all).toBe(0);
    const sale = rowsOf<{ price_tk: number }>(await db.execute(sql`select price_tk from animal_sales`));
    expect(Number(sale[0]!.price_tk)).toBe(120000);
  });
});
