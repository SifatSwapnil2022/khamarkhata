import { and, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { animalMedia, animals, mediaFiles } from "@/db/schema";
import { can } from "@/lib/rbac";
import { err, ok, type Result } from "@/lib/result";
import { audit, type Actor } from "./common";

/** The phone shrinks photos before sending; this is a ceiling for anything that slips through. */
export const MAX_PHOTO_BYTES = 900 * 1024;
const TYPES = new Set(["image/jpeg", "image/webp", "image/png"]);

/** Check the first bytes too, so a renamed file can't pass as a photo. */
function looksLikeImage(b: Uint8Array, type: string) {
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}

export type PhotoError = "forbidden" | "not_found" | "type" | "size" | "empty";

/** Save a photo the farm took of one of its animals, and make it that animal's main photo. */
export async function saveAnimalPhoto(
  db: DB,
  actor: Actor,
  input: { tag: string; type: string; bytes: Uint8Array },
): Promise<Result<{ url: string }, PhotoError>> {
  if (!can(actor.role, "animal.write")) return err("forbidden");
  if (!input.bytes.length) return err("empty");
  if (input.bytes.length > MAX_PHOTO_BYTES) return err("size");
  if (!TYPES.has(input.type) || !looksLikeImage(input.bytes, input.type)) return err("type");

  const [animal] = await db
    .select({ id: animals.id })
    .from(animals)
    .where(and(eq(animals.farmId, actor.farmId), eq(animals.tag, input.tag)));
  if (!animal) return err("not_found");

  const url = await db.transaction(async (tx) => {
    const [file] = await tx
      .insert(mediaFiles)
      .values({ farmId: actor.farmId, contentType: input.type, bytes: Buffer.from(input.bytes), size: input.bytes.length, createdById: actor.userId })
      .returning({ id: mediaFiles.id });
    const url = `/media/${file!.id}`;
    await tx.update(animalMedia).set({ isCover: false }).where(eq(animalMedia.animalId, animal.id));
    await tx.insert(animalMedia).values({ farmId: actor.farmId, animalId: animal.id, url, kind: "photo", isCover: true });
    return url;
  });
  await audit(db, actor, "animal.photo", "animal", animal.id, { tag: input.tag });
  return ok({ url });
}

export async function getMediaFile(db: DB, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select({ type: mediaFiles.contentType, bytes: mediaFiles.bytes }).from(mediaFiles).where(eq(mediaFiles.id, id));
  return row ?? null;
}
