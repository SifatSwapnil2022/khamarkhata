"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { saveAnimalPhoto } from "@/server/media";

export type PhotoState = { ok?: boolean; error?: string };

export async function animalPhotoAction(_prev: PhotoState, form: FormData): Promise<PhotoState> {
  const { actor } = await requirePermission("animal.write");
  const tag = String(form.get("tag") ?? "");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "empty" };
  const res = await saveAnimalPhoto(await getDb(), actor, { tag, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (!res.ok) return { error: res.error };
  revalidatePath("/app", "layout");
  revalidatePath("/market", "layout");
  return { ok: true };
}
