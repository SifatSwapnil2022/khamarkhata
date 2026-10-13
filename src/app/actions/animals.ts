"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requirePermission } from "@/server/auth";
import { createAnimal, getAnimalId, recordExit, updateAnimal, type AnimalInput } from "@/server/animals";

export type AnimalFormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };

const FIELDS = [
  "tag", "name", "nameBn", "sex", "purpose", "breedLabel", "breedPercent", "color", "birthDate", "birthDateEstimated",
  "origin", "purchaseDate", "purchasePriceTk", "purchasedFrom", "damTag", "sireTag", "shedId", "notes",
] as const;

function readAnimal(form: FormData) {
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = form.get(f);
    if (typeof v === "string") values[f] = v;
  }
  return { input: values as unknown as AnimalInput, values };
}

export async function createAnimalAction(_prev: AnimalFormState, form: FormData): Promise<AnimalFormState> {
  const { actor } = await requirePermission("animal.write");
  const { input, values } = readAnimal(form);
  const res = await createAnimal(await getDb(), actor, input);
  if (!res.ok) return { error: res.error, fields: res.fields, values };
  revalidatePath("/app", "layout");
  redirect(`/app/animals/${encodeURIComponent(res.value.tag)}`);
}

export async function updateAnimalAction(_prev: AnimalFormState, form: FormData): Promise<AnimalFormState> {
  const { actor } = await requirePermission("animal.write");
  const db = await getDb();
  const current = await getAnimalId(db, actor.farmId, String(form.get("currentTag") ?? ""));
  if (!current) return { error: "not_found" };
  const { input, values } = readAnimal(form);
  const res = await updateAnimal(db, actor, current.id, input);
  if (!res.ok) return { error: res.error, fields: res.fields, values };
  revalidatePath("/app", "layout");
  redirect(`/app/animals/${encodeURIComponent(res.value.tag)}`);
}

export async function exitAnimalAction(_prev: AnimalFormState, form: FormData): Promise<AnimalFormState> {
  const { actor } = await requirePermission("animal.write");
  const db = await getDb();
  const tag = String(form.get("currentTag") ?? "");
  const current = await getAnimalId(db, actor.farmId, tag);
  if (!current) return { error: "not_found" };
  const values = Object.fromEntries(
    ["lifecycle", "date", "reason", "priceTk", "buyerName", "buyerPhone", "weightKg"].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const res = await recordExit(db, actor, current.id, values as never);
  if (!res.ok) return { error: res.error, fields: res.fields, values };
  revalidatePath("/app", "layout");
  redirect(`/app/animals/${encodeURIComponent(tag)}`);
}
