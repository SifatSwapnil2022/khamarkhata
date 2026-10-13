import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { fatteningBoard, saveWeighIns, tapeWeightKg, weighSheet } from "@/server/qurbani";

const DAY = "2026-10-13";

describe("tape weight", () => {
  it("matches Schaeffer's formula", () => {
    // 72 in girth, 66 in length → 72²×66/300 = 1140 lb = 517 kg
    expect(tapeWeightKg(72 * 2.54, 66 * 2.54)).toBeCloseTo(517, -1);
  });
});

describe("qurbani on the demo farm", () => {
  let db: DB;
  let worker: Actor;
  let vet: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const w = rows.find((r) => r.role === "worker")!;
    const v = rows.find((r) => r.role === "vet")!;
    worker = { farmId: w.farm_id, userId: w.user_id, role: "worker" };
    vet = { farmId: v.farm_id, userId: v.user_id, role: "vet" };
  }, 120_000);

  it("projects every bull to Eid with cost and margin", async () => {
    const { eid, bulls, daysToEid } = await fatteningBoard(db, worker.farmId);
    expect(eid?.date).toBe("2027-05-16");
    expect(daysToEid).toBe(215);
    expect(bulls).toHaveLength(100);
    const b = bulls[0]!;
    expect(b.latestKg).toBeGreaterThan(150);
    expect(b.adg).toBeGreaterThan(0.2);
    expect(b.projectedKg).toBeGreaterThan(b.latestKg!);
    expect(b.costTk).toBeGreaterThan(50_000);
    expect(b.feedPerDayTk).toBeGreaterThan(50);
    expect(b.feedPerDayTk).toBeLessThan(600);
    const statuses = new Set(bulls.map((x) => x.status));
    expect(statuses.has("behind") || statuses.has("on_track")).toBe(true);
  });

  it("saves a weighing day by scale and tape, replacing on re-save", async () => {
    const date = "2026-10-14";
    const sheet = await weighSheet(db, worker.farmId, "qurbani", date);
    const [a, b] = sheet;
    const input = {
      date,
      entries: [
        { animalId: a!.id, method: "scale" as const, kg: 320 },
        { animalId: b!.id, method: "tape" as const, girthCm: 170, lengthCm: 150 },
      ],
    };
    expect((await saveWeighIns(db, worker, input, date)).ok).toBe(true);
    await saveWeighIns(db, worker, input, date);
    const after = await weighSheet(db, worker.farmId, "qurbani", date);
    expect(after.find((r) => r.id === a!.id)?.today?.kg).toBe(320);
    expect(after.find((r) => r.id === b!.id)?.today?.kg).toBe(tapeWeightKg(170, 150));
    const n = rowsOf<{ n: number }>(await db.execute(sql`select count(*)::int as n from weigh_ins where date = ${date}`))[0]!.n;
    expect(n).toBe(2);
  });

  it("refuses a vet, a future day and an impossible weight", async () => {
    const [a] = await weighSheet(db, worker.farmId, "qurbani", DAY);
    expect((await saveWeighIns(db, vet, { date: DAY, entries: [{ animalId: a!.id, method: "scale", kg: 300 }] }, DAY)).ok).toBe(false);
    expect((await saveWeighIns(db, worker, { date: "2026-12-01", entries: [{ animalId: a!.id, method: "scale", kg: 300 }] }, DAY)).ok).toBe(false);
    expect((await saveWeighIns(db, worker, { date: DAY, entries: [{ animalId: a!.id, method: "tape", girthCm: 50 }] }, DAY)).ok).toBe(false);
  });
});
