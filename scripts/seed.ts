/**
 * Demo data for phase 1: one farm with an owner, a manager, and a pending worker invite.
 * Sign in as the owner with 01700-000001 (the OTP prints in the dev server terminal).
 * Animal, milk and health data is added to this seed in later phases.
 */
import { createDb } from "../src/db/client";
import { users } from "../src/db/schema";
import { createFarm } from "../src/server/farms";
import { inviteMember, respondToInvite } from "../src/server/team";

async function main() {
  const db = await createDb(process.env.DATABASE_URL, { migrate: true });

  const [owner] = await db
    .insert(users)
    .values({ phone: "+8801700000001", name: "Rahim Uddin" })
    .onConflictDoNothing()
    .returning();
  if (!owner) {
    console.log("Seed already applied. Run `npm run db:reset` first for a clean database.");
    process.exit(0);
  }

  const farm = await createFarm(db, owner.id, {
    ownerName: "Rahim Uddin",
    name: "Shonali Dairy & Fattening (demo)",
    district: "Sirajganj",
    upazila: "Shahjadpur",
    segments: ["dairy", "breeding", "qurbani"],
  });
  const actor = { userId: owner.id, farmId: farm.id, role: "owner" as const };

  const [manager] = await db.insert(users).values({ phone: "+8801700000002", name: "Selim Hossain" }).returning();
  const inv = await inviteMember(db, actor, { phone: manager!.phone, role: "manager" });
  if (inv.ok) await respondToInvite(db, manager!, { inviteId: inv.value.inviteId, accept: true });

  await inviteMember(db, actor, { phone: "01700000003", role: "worker" });

  console.log("Seeded demo farm:", farm.name);
  console.log("  owner   01700-000001");
  console.log("  manager 01700-000002");
  console.log("  worker  01700-000003 (pending invite)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
