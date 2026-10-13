"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { Role } from "@/db/schema";
import { requirePermission, requireUser } from "@/server/auth";
import { createFarm, farmInput, getMembership, updateFarm, type FarmInput } from "@/server/farms";
import { setActiveFarm } from "@/server/sessions";
import { changeRole, inviteMember, removeMember, respondToInvite, revokeInvite } from "@/server/team";

export type FormState = { error?: string; fields?: Record<string, string>; done?: boolean };

const readSegments = (form: FormData) => form.getAll("segments").map(String);

export async function createFarmAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, token } = await requireUser();
  const input = {
    ownerName: String(form.get("ownerName") ?? ""),
    name: String(form.get("name") ?? ""),
    district: String(form.get("district") ?? ""),
    upazila: String(form.get("upazila") ?? ""),
    segments: readSegments(form),
  };
  const parsed = farmInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
    return { error: "invalid", fields };
  }
  const db = await getDb();
  const farm = await createFarm(db, user.id, input as FarmInput);
  await setActiveFarm(db, token, farm.id);
  redirect("/app");
}

export async function updateFarmAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { actor } = await requirePermission("farm.update");
  const db = await getDb();
  // Raw form values; updateFarm validates and coerces them with zod.
  const input = {
    name: form.get("name"),
    district: form.get("district"),
    upazila: form.get("upazila") ?? "",
    segments: readSegments(form),
    heatCycleDays: form.get("heatCycleDays"),
    pregnancyCheckDays: form.get("pregnancyCheckDays"),
    gestationDays: form.get("gestationDays"),
    dryOffDaysBeforeCalving: form.get("dryOffDaysBeforeCalving"),
  } as Parameters<typeof updateFarm>[2];
  const res = await updateFarm(db, actor, input);
  if (!res.ok) return { error: res.error };
  revalidatePath("/app", "layout");
  return { done: true };
}

export async function switchFarmAction(form: FormData) {
  const { user, token } = await requireUser();
  const farmId = String(form.get("farmId") ?? "");
  const db = await getDb();
  if (await getMembership(db, user.id, farmId)) await setActiveFarm(db, token, farmId);
  redirect("/app");
}

/* ─────────── Team ─────────── */

export async function inviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { actor } = await requirePermission("team.invite");
  const res = await inviteMember(await getDb(), actor, {
    phone: String(form.get("phone") ?? ""),
    role: String(form.get("role")) as Role,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/app/team");
  return { done: true };
}

export async function revokeInviteAction(form: FormData) {
  const { actor } = await requirePermission("team.invite");
  await revokeInvite(await getDb(), actor, String(form.get("inviteId")));
  revalidatePath("/app/team");
}

export async function changeRoleAction(form: FormData) {
  const { actor } = await requirePermission("team.manage");
  await changeRole(await getDb(), actor, {
    userId: String(form.get("userId")),
    role: String(form.get("role")) as Role,
  });
  revalidatePath("/app/team");
}

export async function removeMemberAction(form: FormData) {
  const { actor } = await requirePermission("team.invite");
  await removeMember(await getDb(), actor, String(form.get("userId")));
  revalidatePath("/app/team");
}

export async function respondInviteAction(form: FormData) {
  const { user, token } = await requireUser();
  const db = await getDb();
  const accept = form.get("decision") === "accept";
  const res = await respondToInvite(db, user, { inviteId: String(form.get("inviteId")), accept });
  if (res.ok && res.value.farmId) {
    await setActiveFarm(db, token, res.value.farmId);
    redirect("/app");
  }
  revalidatePath("/invites");
}
