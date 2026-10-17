"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getAnimalId, recordExit } from "@/server/animals";
import { clientIp, getCurrentUser, requirePermission } from "@/server/auth";
import { createInquiry, createListing, setInquiryStatus, setListingStatus, updateListing } from "@/server/market";
import type { ActionState } from "./dairy";

const read = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));

export async function inquiryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const values = read(form, ["slug", "name", "phone", "message", "website"]);
  const [current, ip] = await Promise.all([getCurrentUser(), clientIp()]);
  const res = await createInquiry(await getDb(), values as never, { ip, userId: current?.user.id ?? null });
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/app/market");
  return { ok: values.phone };
}

export async function createListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("listing.manage");
  const values = read(form, ["animalId", "category", "title", "description", "priceTk", "negotiable", "publish"]);
  const res = await createListing(await getDb(), actor, { ...values, negotiable: values.negotiable === "on", publish: values.publish === "on" } as never);
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/market");
  redirect("/app/market");
}

export async function updateListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("listing.manage");
  const values = read(form, ["id", "title", "description", "priceTk", "negotiable"]);
  const res = await updateListing(await getDb(), actor, values.id!, { ...values, negotiable: values.negotiable === "on" } as never);
  if (!res.ok) return { error: res.error, fields: "fields" in res ? res.fields : undefined, values };
  revalidatePath("/market", "layout");
  revalidatePath("/app/market");
  return { ok: "saved" };
}

export async function listingStatusAction(form: FormData) {
  const { actor } = await requirePermission("listing.manage");
  const status = form.get("status") === "active" ? "active" : "withdrawn";
  await setListingStatus(await getDb(), actor, String(form.get("id") ?? ""), status);
  revalidatePath("/market", "layout");
  revalidatePath("/app/market");
}

export async function inquiryStatusAction(form: FormData) {
  const { actor } = await requirePermission("listing.manage");
  const s = String(form.get("status"));
  const status = s === "replied" || s === "closed" ? s : "new";
  await setInquiryStatus(await getDb(), actor, String(form.get("id") ?? ""), status);
  revalidatePath("/app/market");
}

/** Selling an animal from its listing records the sale on the animal, which closes the listing. */
export async function sellListingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { actor } = await requirePermission("animal.write");
  const db = await getDb();
  const values = read(form, ["tag", "date", "priceTk", "buyerName", "buyerPhone", "weightKg"]);
  const animal = await getAnimalId(db, actor.farmId, values.tag!);
  if (!animal) return { error: "not_found" };
  const res = await recordExit(db, actor, animal.id, { lifecycle: "sold", reason: "", ...values } as never);
  if (!res.ok) return { error: res.error, fields: res.fields, values };
  revalidatePath("/market", "layout");
  revalidatePath("/app", "layout");
  return { ok: "sold" };
}
