export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

/** Logs messages to the server terminal. Used in development and tests. */
export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.info(`[sms → ${to}] ${message}`);
  }
}

/**
 * Plug a real Bangladeshi SMS gateway in here (it should implement SmsProvider).
 * Keep API keys in env vars; never log the message body in production.
 */
export function getSmsProvider(): SmsProvider {
  const provider = process.env.SMS_PROVIDER ?? "console";
  if (provider === "console") return new ConsoleSmsProvider();
  throw new Error(`Unknown SMS_PROVIDER "${provider}". Add an implementation in src/server/sms.ts.`);
}
