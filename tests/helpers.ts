import { cpSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, MIGRATIONS_DIR } from "@/db/client";
import type { SmsProvider } from "@/server/sms";

/** Schema migrations only: tests start from an empty database, without the demo farm. */
let schemaOnly: string | undefined;
function schemaMigrations() {
  if (!schemaOnly) {
    schemaOnly = mkdtempSync(path.join(tmpdir(), "kk-migrations-"));
    for (const dir of readdirSync(MIGRATIONS_DIR)) {
      if (!dir.includes("demo")) cpSync(path.join(MIGRATIONS_DIR, dir), path.join(schemaOnly, dir), { recursive: true });
    }
  }
  return schemaOnly;
}

export const testDb = () => createDb("memory", { migrate: true, migrationsFolder: schemaMigrations() });

export class RecordingSms implements SmsProvider {
  sent: { to: string; message: string }[] = [];
  async send(to: string, message: string) {
    this.sent.push({ to, message });
  }
}
