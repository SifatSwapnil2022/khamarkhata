import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { respondInviteAction } from "@/app/actions/farm";
import { Badge, Button, Card, Logo } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { requireUser } from "@/server/auth";
import { listUserFarms } from "@/server/farms";
import { pendingInvitesFor } from "@/server/team";

export const metadata: Metadata = { title: "Invites" };

export default async function InvitesPage() {
  const [{ t }, { user }] = await Promise.all([getDictionary(), requireUser()]);
  const db = await getDb();
  const [pending, farms] = await Promise.all([pendingInvitesFor(db, user.phone), listUserFarms(db, user.id)]);
  if (pending.length === 0) redirect(farms.length > 0 ? "/app" : "/onboarding");

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-6">
      <span className="flex items-center gap-2">
        <Logo size={32} />
        <span className="font-display font-extrabold">{t.common.appName}</span>
      </span>
      <main className="flex flex-col gap-4 py-10">
        <h1 className="text-[length:var(--text-title)] leading-tight font-extrabold">{t.invites.title}</h1>
        <p className="text-ink-2">{t.invites.subtitle}</p>
        <ul className="mt-2 flex flex-col gap-3">
          {pending.map((inv) => (
            <li key={inv.id}>
              <Card className="flex flex-col gap-4">
                <div>
                  <p className="font-display text-xl font-bold">{inv.farmName}</p>
                  <p className="text-sm text-muted">
                    {inv.district} · {t.invites.invitedBy} {inv.invitedBy ?? "—"}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    {t.invites.as} <Badge tone="green">{t.roles[inv.role]}</Badge>
                  </p>
                  <p className="mt-2 text-sm text-ink-2">{t.team.roleHelp[inv.role]}</p>
                </div>
                <form action={respondInviteAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="inviteId" value={inv.id} />
                  <Button type="submit" name="decision" value="accept">
                    {t.invites.accept}
                  </Button>
                  <Button type="submit" name="decision" value="decline" variant="secondary">
                    {t.invites.decline}
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
        {farms.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {t.invites.or}{" "}
            <Link href="/onboarding" className="font-semibold text-primary">
              {t.invites.createOwn}
            </Link>
          </p>
        ) : (
          <Link href="/app" className="mt-4 text-sm font-semibold text-primary">
            {t.common.openFarm} →
          </Link>
        )}
      </main>
    </div>
  );
}
