import { and, asc, desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { auditLogs, farms, invites, memberships, users, type Role } from "@/db/schema";
import { normalizeBdPhone } from "@/lib/phone";
import { can, canAssign } from "@/lib/rbac";
import { err, ok, type Result } from "@/lib/result";

/** The signed-in user acting on a farm, as resolved from their membership. */
export type Actor = { userId: string; farmId: string; role: Role };

export async function listTeam(db: DB, farmId: string) {
  const members = await db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.farmId, farmId))
    .orderBy(asc(memberships.createdAt));

  const pending = await db
    .select()
    .from(invites)
    .where(and(eq(invites.farmId, farmId), eq(invites.status, "pending")))
    .orderBy(desc(invites.createdAt));

  return { members, pending };
}

type InviteError = "forbidden" | "invalid_phone" | "already_member" | "already_invited";

export async function inviteMember(
  db: DB,
  actor: Actor,
  input: { phone: string; role: Role },
): Promise<Result<{ inviteId: string }, InviteError>> {
  if (!can(actor.role, "team.invite") || !canAssign(actor.role, input.role)) return err("forbidden");
  const phone = normalizeBdPhone(input.phone);
  if (!phone) return err("invalid_phone");

  const [member] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.farmId, actor.farmId), eq(users.phone, phone)));
  if (member) return err("already_member");

  const [existing] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.farmId, actor.farmId), eq(invites.phone, phone), eq(invites.status, "pending")));
  if (existing) return err("already_invited");

  const [invite] = await db
    .insert(invites)
    .values({ farmId: actor.farmId, phone, role: input.role, invitedById: actor.userId })
    .returning({ id: invites.id });
  await audit(db, actor, "invite.create", "invite", invite!.id, { phone, role: input.role });
  return ok({ inviteId: invite!.id });
}

export async function revokeInvite(db: DB, actor: Actor, inviteId: string): Promise<Result<true, "forbidden" | "not_found">> {
  const [invite] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.farmId, actor.farmId), eq(invites.status, "pending")));
  if (!invite) return err("not_found");
  if (!can(actor.role, "team.invite") || !canAssign(actor.role, invite.role)) return err("forbidden");
  await db.update(invites).set({ status: "revoked", respondedAt: new Date() }).where(eq(invites.id, inviteId));
  await audit(db, actor, "invite.revoke", "invite", inviteId);
  return ok(true);
}

type MemberError = "forbidden" | "not_found" | "self";

export async function changeRole(
  db: DB,
  actor: Actor,
  input: { userId: string; role: Role },
): Promise<Result<true, MemberError>> {
  if (input.userId === actor.userId) return err("self");
  if (!can(actor.role, "team.manage") || !canAssign(actor.role, input.role)) return err("forbidden");
  const target = await findMember(db, actor.farmId, input.userId);
  if (!target) return err("not_found");
  if (!canAssign(actor.role, target.role)) return err("forbidden");

  await db
    .update(memberships)
    .set({ role: input.role })
    .where(and(eq(memberships.farmId, actor.farmId), eq(memberships.userId, input.userId)));
  await audit(db, actor, "member.role_change", "membership", target.id, { from: target.role, to: input.role });
  return ok(true);
}

export async function removeMember(db: DB, actor: Actor, userId: string): Promise<Result<true, MemberError>> {
  if (userId === actor.userId) return err("self");
  const target = await findMember(db, actor.farmId, userId);
  if (!target) return err("not_found");
  // Owners can remove managers/workers/vets; managers can remove workers/vets. Nobody removes the owner.
  if (!can(actor.role, "team.invite") || !canAssign(actor.role, target.role)) return err("forbidden");

  await db.delete(memberships).where(eq(memberships.id, target.id));
  await audit(db, actor, "member.remove", "membership", target.id, { userId, role: target.role });
  return ok(true);
}

/* ─────────── Invitee side ─────────── */

export async function pendingInvitesFor(db: DB, phone: string) {
  return db
    .select({
      id: invites.id,
      role: invites.role,
      createdAt: invites.createdAt,
      farmName: farms.name,
      district: farms.district,
      invitedBy: users.name,
    })
    .from(invites)
    .innerJoin(farms, eq(farms.id, invites.farmId))
    .innerJoin(users, eq(users.id, invites.invitedById))
    .where(and(eq(invites.phone, phone), eq(invites.status, "pending")))
    .orderBy(desc(invites.createdAt));
}

export async function respondToInvite(
  db: DB,
  user: { id: string; phone: string },
  input: { inviteId: string; accept: boolean },
): Promise<Result<{ farmId: string | null }, "not_found">> {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invites)
      .where(and(eq(invites.id, input.inviteId), eq(invites.phone, user.phone), eq(invites.status, "pending")));
    if (!invite) return err("not_found");

    await tx
      .update(invites)
      .set({ status: input.accept ? "accepted" : "declined", respondedAt: new Date() })
      .where(eq(invites.id, invite.id));

    if (!input.accept) return ok({ farmId: null });

    await tx
      .insert(memberships)
      .values({ farmId: invite.farmId, userId: user.id, role: invite.role })
      .onConflictDoNothing();
    await tx.insert(auditLogs).values({
      farmId: invite.farmId,
      actorId: user.id,
      action: "invite.accept",
      entityType: "invite",
      entityId: invite.id,
    });
    return ok({ farmId: invite.farmId });
  });
}

/* ─────────── helpers ─────────── */

async function findMember(db: DB, farmId: string, userId: string) {
  const [row] = await db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.farmId, farmId), eq(memberships.userId, userId)));
  return row ?? null;
}

async function audit(db: DB, actor: Actor, action: string, entityType: string, entityId: string, data?: unknown) {
  await db.insert(auditLogs).values({
    farmId: actor.farmId,
    actorId: actor.userId,
    action,
    entityType,
    entityId,
    data: data ?? null,
  });
}
