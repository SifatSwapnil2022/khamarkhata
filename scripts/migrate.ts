import { createDb } from "../src/db/client";

async function main() {
  await createDb(process.env.DATABASE_URL, { migrate: true });
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
