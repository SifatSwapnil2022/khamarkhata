import { createDb } from "@/db/client";
import type { SmsProvider } from "@/server/sms";

export const testDb = () => createDb("memory", { migrate: true });

export class RecordingSms implements SmsProvider {
  sent: { to: string; message: string }[] = [];
  async send(to: string, message: string) {
    this.sent.push({ to, message });
  }
}
