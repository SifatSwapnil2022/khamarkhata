import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db/client";
import { users } from "@/db/schema";
import { normalizeBdPhone } from "@/lib/phone";
import { createFarm, getMembership, listUserFarms } from "@/server/farms";
import {
  changeRole,
  inviteMember,
  listTeam,
  pendingInvitesFor,
  removeMember,
  respondToInvite,
  revokeInvite,
  type Actor,
} from "@/server/team";
import { testDb } from "./helpers";

let db: DB;
let owner: Actor;

async function makeUser(phone: string, name: string) {
  const [u] = await db.insert(users).values({ phone: normalizeBdPhone(phone)!, name }).returning();
  return u!;
}

async function join(phone: string, name: string, role: "manager" | "worker" | "vet", by: Actor = owner) {
  const user = await makeUser(phone, name);
  const inv = await inviteMember(db, by, { phone, role });
  if (!inv.ok) throw new Error(inv.error);
  const accepted = await respondToInvite(db, user, { inviteId: inv.value.inviteId, accept: true });
  if (!accepted.ok) throw new Error(accepted.error);
  return { user, actor: { userId: user.id, farmId: owner.farmId, role } satisfies Actor };
}

beforeEach(async () => {
  db = await testDb();
  const u = await makeUser("+8801711111111", "Rahim");
  const farm = await createFarm(db, u.id, {
    ownerName: "Rahim Uddin",
    name: "Shonali Dairy",
    district: "Sirajganj",
    segments: ["dairy", "qurbani"],
  });
  owner = { userId: u.id, farmId: farm.id, role: "owner" };
});

describe("createFarm", () => {
  it("makes the creator owner and stores default breeding rules", async () => {
    const m = await getMembership(db, owner.userId, owner.farmId);
    expect(m?.role).toBe("owner");
    expect(m?.farm.settings.gestationDays).toBe(283);
    expect(await listUserFarms(db, owner.userId)).toHaveLength(1);
  });

  it("rejects an unknown district", async () => {
    await expect(
      createFarm(db, owner.userId, { ownerName: "R", name: "X", district: "Atlantis", segments: ["dairy"] }),
    ).rejects.toThrow();
  });
});

describe("invites", () => {
  it("invite → accept creates a membership with the invited role", async () => {
    const { user } = await join("01822222222", "Karim", "worker");
    expect((await getMembership(db, user.id, owner.farmId))?.role).toBe("worker");
    expect(await pendingInvitesFor(db, "+8801822222222")).toHaveLength(0);
  });

  it("blocks duplicate invites and inviting existing members", async () => {
    await inviteMember(db, owner, { phone: "01822222222", role: "worker" });
    expect(await inviteMember(db, owner, { phone: "+8801822222222", role: "vet" })).toMatchObject({
      error: "already_invited",
    });
    expect(await inviteMember(db, owner, { phone: "01711111111", role: "worker" })).toMatchObject({
      error: "already_member",
    });
  });

  it("a manager can invite workers but not managers", async () => {
    const { actor: manager } = await join("01933333333", "Selim", "manager");
    expect((await inviteMember(db, manager, { phone: "01544444444", role: "worker" })).ok).toBe(true);
    expect(await inviteMember(db, manager, { phone: "01555555555", role: "manager" })).toMatchObject({
      error: "forbidden",
    });
  });

  it("a worker cannot invite anyone", async () => {
    const { actor: worker } = await join("01822222222", "Karim", "worker");
    expect(await inviteMember(db, worker, { phone: "01544444444", role: "worker" })).toMatchObject({
      error: "forbidden",
    });
  });

  it("only the invited phone can accept", async () => {
    const inv = await inviteMember(db, owner, { phone: "01822222222", role: "worker" });
    if (!inv.ok) throw new Error(inv.error);
    const stranger = await makeUser("+8801699999999", "Stranger");
    expect(await respondToInvite(db, stranger, { inviteId: inv.value.inviteId, accept: true })).toMatchObject({
      error: "not_found",
    });
  });

  it("revoked invites can't be accepted", async () => {
    const user = await makeUser("+8801822222222", "Karim");
    const inv = await inviteMember(db, owner, { phone: user.phone, role: "worker" });
    if (!inv.ok) throw new Error(inv.error);
    expect((await revokeInvite(db, owner, inv.value.inviteId)).ok).toBe(true);
    expect((await respondToInvite(db, user, { inviteId: inv.value.inviteId, accept: true })).ok).toBe(false);
  });
});

describe("members", () => {
  it("owner can change roles; manager cannot", async () => {
    const { user: karim } = await join("01822222222", "Karim", "worker");
    const { actor: manager } = await join("01933333333", "Selim", "manager");
    expect(await changeRole(db, manager, { userId: karim.id, role: "vet" })).toMatchObject({ error: "forbidden" });
    expect((await changeRole(db, owner, { userId: karim.id, role: "manager" })).ok).toBe(true);
  });

  it("nobody can remove the owner or themselves", async () => {
    const { actor: manager } = await join("01933333333", "Selim", "manager");
    expect(await removeMember(db, manager, owner.userId)).toMatchObject({ error: "forbidden" });
    expect(await removeMember(db, owner, owner.userId)).toMatchObject({ error: "self" });
  });

  it("removing a member takes away their access", async () => {
    const { user: karim } = await join("01822222222", "Karim", "worker");
    expect((await removeMember(db, owner, karim.id)).ok).toBe(true);
    expect(await getMembership(db, karim.id, owner.farmId)).toBeNull();
    const team = await listTeam(db, owner.farmId);
    expect(team.members.map((m) => m.name)).toEqual(["Rahim Uddin"]);
  });

  it("actions are scoped to the actor's farm", async () => {
    const other = await makeUser("+8801766666666", "Other owner");
    const farm2 = await createFarm(db, other.id, {
      ownerName: "Other",
      name: "Other farm",
      district: "Pabna",
      segments: ["dairy"],
    });
    const otherOwner: Actor = { userId: other.id, farmId: farm2.id, role: "owner" };
    const { user: karim } = await join("01822222222", "Karim", "worker");
    expect(await removeMember(db, otherOwner, karim.id)).toMatchObject({ error: "not_found" });
  });
});
