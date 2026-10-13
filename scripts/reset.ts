/** Deletes the local embedded database (./.data). Refuses to touch a real Postgres server. */
import { rm } from "node:fs/promises";
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url && url !== "pglite") {
    console.error("db:reset only clears the embedded PGlite database. Drop a real Postgres database yourself.");
    process.exit(1);
  }
  await rm(path.join(process.cwd(), ".data"), { recursive: true, force: true });
  console.log("Local database removed. It is recreated and migrated on next start.");
}

main();
