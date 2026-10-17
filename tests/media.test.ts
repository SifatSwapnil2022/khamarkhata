import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type DB } from "@/db/client";
import { rowsOf } from "@/db/rows";
import type { Actor } from "@/server/common";
import { getMediaFile, saveAnimalPhoto } from "@/server/media";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

describe("animal photos", () => {
  let db: DB;
  let owner: Actor;
  let vet: Actor;
  beforeAll(async () => {
    db = await createDb("memory", { migrate: true });
    const rows = rowsOf<{ farm_id: string; user_id: string; role: Actor["role"] }>(
      await db.execute(sql`select m.farm_id, m.user_id, m.role from memberships m join farms f on f.id = m.farm_id where f.name like '%(demo)'`),
    );
    const o = rows.find((r) => r.role === "owner")!;
    const v = rows.find((r) => r.role === "vet")!;
    owner = { farmId: o.farm_id, userId: o.user_id, role: "owner" };
    vet = { farmId: v.farm_id, userId: v.user_id, role: "vet" };
  }, 120_000);

  it("stores the photo, serves it back, and makes it the animal's main photo", async () => {
    const res = await saveAnimalPhoto(db, owner, { tag: "D-040", type: "image/jpeg", bytes: JPEG });
    if (!res.ok) throw new Error(res.error);
    const file = await getMediaFile(db, res.value.url.split("/").pop()!);
    expect(file?.type).toBe("image/jpeg");
    expect(new Uint8Array(file!.bytes)).toEqual(JPEG);
    const covers = rowsOf<{ url: string }>(
      await db.execute(sql`select m.url from animal_media m join animals a on a.id = m.animal_id where a.tag = 'D-040' and m.is_cover`),
    );
    expect(covers.map((c) => c.url)).toEqual([res.value.url]);
  });

  it("refuses files that aren't photos, other farms' tags and roles without animal.write", async () => {
    expect(await saveAnimalPhoto(db, owner, { tag: "D-040", type: "image/jpeg", bytes: new TextEncoder().encode("<html>") })).toMatchObject({ error: "type" });
    expect(await saveAnimalPhoto(db, owner, { tag: "NOPE-1", type: "image/jpeg", bytes: JPEG })).toMatchObject({ error: "not_found" });
    expect(await saveAnimalPhoto(db, owner, { tag: "D-040", type: "image/jpeg", bytes: new Uint8Array(950 * 1024).fill(0xff) })).toMatchObject({ error: "size" });
    expect(await saveAnimalPhoto(db, vet, { tag: "D-040", type: "image/jpeg", bytes: JPEG })).toMatchObject({ error: "forbidden" });
    expect(await getMediaFile(db, "not-a-uuid")).toBeNull();
  });

  it("gives every photographed demo animal its own photo, and no colour name contradicts a picture", async () => {
    const dup = rowsOf(await db.execute(sql`select url from animal_media where url not like '/media/%' group by url having count(*) > 1`));
    expect(dup).toEqual([]);
    const clash = rowsOf(
      await db.execute(sql`select a.tag, a.name from animals a join animal_media m on m.animal_id = a.id
        where a.color is null and a.name ~* '^(kal|kalo|kala|dhol|shada|lal|lalu|lali|kali|dholi|dhoboli|shwet|megh raja)'`),
    );
    expect(clash).toEqual([]);
  });
});
