import { createDb } from "../src/db/client";

async function main() {
  // Migrations go over a direct connection when one is available (Neon gives DATABASE_URL_UNPOOLED);
  // the pooled one is for the app.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (process.env.VERCEL && !url?.startsWith("postgres")) {
    throw new Error("DATABASE_URL is not set. Add the Neon connection string in Vercel → Settings → Environment Variables.");
  }
  await createDb(url, { migrate: true });
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
