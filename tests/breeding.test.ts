import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { fertilityKpis, herdBreeding, inbreedingCheck, recordBreedingEvent, sireCatalog } from "@/server/breeding";

const DAY = "2026-10-13";

describe("breeding on the demo farm", () => {
  let db: DB;
  let owner: Actor;
  let worker: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const o = rows.find((r) => r.role === "owner")!;
    const w = rows.find((r) => r.role === "worker")!;
    owner = { farmId: o.farm_id, userId: o.user_id, role: "owner" };
    worker = { farmId: w.farm_id, userId: w.user_id, role: "worker" };
  }, 120_000);

  it("works out each cow's status and next step", async () => {
    const { cows } = await herdBreeding(db, owner.farmId);
    const by = (s: string) => cows.filter((c) => c.status === s).length;
    expect(cows.filter((c) => c.purpose === "dairy")).toHaveLength(100);
    expect(by("pregnant")).toBe(61);
    expect(by("served") + by("open") + by("fresh") + by("heifer")).toBe(cows.length - 61);
    const preg = cows.find((c) => c.status === "pregnant")!;
    expect(preg.expectedCalving).toBeTruthy();
    expect(["calving", "dry_off"]).toContain(preg.next?.type);
  });

  it("reports fertility and sire results", async () => {
    const k = await fertilityKpis(db, owner.farmId);
    expect(k.conceptionRate).toBeGreaterThan(0.2);
    expect(k.conceptionRate).toBeLessThan(0.9);
    expect(k.calvingInterval).toBeGreaterThan(330);
    const sires = await sireCatalog(db, owner.farmId);
    expect(sires.some((s) => s.kind === "straw" && s.services > 0)).toBe(true);
    expect(sires.filter((s) => s.kind === "bull")).toHaveLength(10);
  });

  it("warns before serving a cow with her own sire's straw", async () => {
    const r = rowsOf<{ id: string; tag: string; code: string }>(
      await db.execute(sql`select a.id, a.tag, s.code from animals a join sires s on s.id = a.sire_id where a.farm_id = ${owner.farmId} and a.sex = 'female' and a.lifecycle = 'active' limit 1`),
    )[0]!;
    const sireId = rowsOf<{ id: string }>(await db.execute(sql`select id from sires where code = ${r.code} and farm_id = ${owner.farmId}`))[0]!.id;
    expect(await inbreedingCheck(db, owner.farmId, r.id, { sireId })).toContain("same_straw_as_sire");
    const blocked = await recordBreedingEvent(db, owner, { tag: r.tag, type: "service", date: DAY, method: "ai", sire: r.code }, DAY);
    expect(!blocked.ok && blocked.error).toBe("related");
    const accepted = await recordBreedingEvent(db, owner, { tag: r.tag, type: "service", date: DAY, method: "ai", sire: r.code, acceptRelation: "yes" }, DAY);
    expect(accepted.ok).toBe(true);
  });

  it("workers can log heat but not services", async () => {
    const tag = "D-020";
    expect((await recordBreedingEvent(db, worker, { tag, type: "heat", date: DAY }, DAY)).ok).toBe(true);
    const svc = await recordBreedingEvent(db, worker, { tag, type: "service", date: DAY, method: "ai", sire: "HF-2214" }, DAY);
    expect(!svc.ok && svc.error).toBe("forbidden");
  });

  it("calving creates the calf with both parents", async () => {
    const { cows } = await herdBreeding(db, owner.farmId);
    const cow = cows.find((c) => c.status === "pregnant")!;
    const res = await recordBreedingEvent(db, owner, { tag: cow.tag, type: "calving", date: DAY, calfTag: "c-900", calfSex: "female", calvingEase: "normal" }, DAY);
    expect(res.ok && res.value.calfTag).toBe("C-900");
    const calf = rowsOf<{ dam_id: string; sire_id: string | null; sire_animal_id: string | null; purpose: string }>(
      await db.execute(sql`select dam_id, sire_id, sire_animal_id, purpose::text from animals where farm_id = ${owner.farmId} and tag = 'C-900'`),
    )[0]!;
    expect(calf.dam_id).toBe(cow.id);
    expect(calf.sire_id ?? calf.sire_animal_id).toBeTruthy();
    const after = (await herdBreeding(db, owner.farmId)).cows.find((c) => c.id === cow.id)!;
    expect(after.status).toBe("fresh");
    const dup = await recordBreedingEvent(db, owner, { tag: cow.tag, type: "calving", date: DAY, calfTag: "C-900", calfSex: "male" }, DAY);
    expect(!dup.ok && "fields" in dup && dup.fields?.calfTag).toBe("taken");
  });

  it("refuses bulls as dams and unknown bulls as sires", async () => {
    const bull = await recordBreedingEvent(db, owner, { tag: "Q-001", type: "heat", date: DAY }, DAY);
    expect(!bull.ok && "fields" in bull && bull.fields?.tag).toBe("not_female");
    const nat = await recordBreedingEvent(db, owner, { tag: "D-030", type: "service", date: DAY, method: "natural", sire: "D-001" }, DAY);
    expect(!nat.ok && "fields" in nat && nat.fields?.sire).toBe("not_bull");
  });
});
