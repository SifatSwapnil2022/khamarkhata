import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { activeWithdrawals, coverage, dueList, recordTreatment, recordVaccination, vaccineOptions } from "@/server/health";

const DAY = "2026-10-13";

describe("health on the demo farm", () => {
  let db: DB;
  let vet: Actor;
  let worker: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const v = rows.find((r) => r.role === "vet")!;
    const w = rows.find((r) => r.role === "worker")!;
    vet = { farmId: v.farm_id, userId: v.user_id, role: "vet" };
    worker = { farmId: w.farm_id, userId: w.user_id, role: "worker" };
  }, 120_000);

  it("lists overdue FMD boosters", async () => {
    const { items } = await dueList(db, vet.farmId);
    const fmdOverdue = items.filter((i) => i.vaccine === "FMD" && i.overdueDays > 0);
    expect(fmdOverdue.length).toBe(29);
    expect(items.every((i) => i.dueDate <= "2026-10-27")).toBe(true);
  });

  it("vaccinating the due animals clears them from the list", async () => {
    const vaccines = await vaccineOptions(db, vet.farmId);
    const fmd = vaccines.find((v) => v.name === "FMD")!;
    const due = (await dueList(db, vet.farmId)).items.filter((i) => i.vaccineId === fmd.id);
    const res = await recordVaccination(db, vet, { vaccineId: fmd.id, date: DAY, animalIds: due.map((d) => d.animalId), batchNo: "FMD-2026-114" }, DAY);
    expect(res.ok && res.value.count).toBe(due.length);
    expect(res.ok && res.value.next).toBe("2027-04-11");
    const after = (await dueList(db, vet.farmId)).items.filter((i) => i.vaccineId === fmd.id);
    expect(after).toHaveLength(0);
    const cov = (await coverage(db, vet.farmId)).find((c) => c.id === fmd.id)!;
    expect(cov.covered).toBeGreaterThan(200);
  });

  it("refuses workers, future dates and empty groups", async () => {
    const [v] = await vaccineOptions(db, vet.farmId);
    expect((await recordVaccination(db, worker, { vaccineId: v!.id, date: DAY, animalIds: [crypto.randomUUID()] }, DAY)).ok).toBe(false);
    const future = await recordVaccination(db, vet, { vaccineId: v!.id, date: "2026-11-01", animalIds: [crypto.randomUUID()] }, DAY);
    expect(!future.ok && "fields" in future && future.fields?.date).toBe("future");
    const empty = await recordVaccination(db, vet, { vaccineId: v!.id, date: DAY, animalIds: [crypto.randomUUID()] }, DAY);
    expect(!empty.ok && "fields" in empty && empty.fields?.animalIds).toBe("pick_animals");
  });

  it("a treatment with withdrawal days shows up as running withdrawal", async () => {
    const res = await recordTreatment(
      db,
      vet,
      { tag: "d-010", type: "treatment", date: DAY, diagnosis: "Mastitis", drug: "Ceftiofur", milkWithdrawalDays: "4", meatWithdrawalDays: "10" },
      DAY,
    );
    expect(res.ok).toBe(true);
    const w = (await activeWithdrawals(db, vet.farmId)).find((x) => x.tag === "D-010")!;
    expect(w.milkUntil).toBe("2026-10-17");
    expect(w.meatUntil).toBe("2026-10-23");
  });

  it("won't put a milk withdrawal on a bull or record for an unknown tag", async () => {
    const bull = await recordTreatment(db, vet, { tag: "Q-001", type: "treatment", date: DAY, diagnosis: "Lameness", milkWithdrawalDays: "3" }, DAY);
    expect(!bull.ok && "fields" in bull && bull.fields?.milkWithdrawalDays).toBe("not_female");
    const ghost = await recordTreatment(db, vet, { tag: "ZZ-999", type: "vet_visit", date: DAY }, DAY);
    expect(!ghost.ok && "fields" in ghost && ghost.fields?.tag).toBe("not_found");
  });
});
