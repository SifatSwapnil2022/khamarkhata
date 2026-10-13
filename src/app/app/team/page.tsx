import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changeRoleAction, removeMemberAction, revokeInviteAction } from "@/app/actions/farm";
import { Badge, Card, PageHead, Select } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { formatBdPhone } from "@/lib/phone";
import { assignableRoles, can, canAssign } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { listTeam } from "@/server/team";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const [{ locale, t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  if (!can(ctx.role, "team.view")) redirect("/app");
  const { members, pending } = await listTeam(await getDb(), ctx.farm.id);

  const canInvite = can(ctx.role, "team.invite");
  const canManage = can(ctx.role, "team.manage");
  const dateFmt = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium" });

  return (
    <>
    <PageHead title={t.team.title} subtitle={t.team.subtitle} />
    <div className="page-column flex flex-col gap-6 py-8">

      <div className="flex flex-wrap gap-6">
        <Card flush className="min-w-0 flex-[3_1_480px] self-start">
          <h2 className="px-5 pt-5 font-display text-lg font-bold">{t.team.members}</h2>
          <ul className="mt-2">
            {members.map((m) => {
              const isSelf = m.userId === ctx.user.id;
              const manageable = !isSelf && canAssign(ctx.role, m.role);
              return (
                <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-5 py-4">
                  <div className="min-w-0 flex-[1_1_200px]">
                    <p className="font-semibold">
                      {m.name ?? "—"} {isSelf ? <span className="font-normal text-muted">({t.team.you})</span> : null}
                    </p>
                    <p className="text-sm text-muted">
                      {formatBdPhone(m.phone)} · {t.team.joined} {dateFmt.format(m.joinedAt)}
                    </p>
                  </div>

                  {canManage && manageable ? (
                    <form action={changeRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={m.userId} />
                      <label htmlFor={`role-${m.userId}`} className="sr-only">
                        {t.team.changeRole}
                      </label>
                      <Select id={`role-${m.userId}`} name="role" defaultValue={m.role} className="w-auto">
                        {assignableRoles(ctx.role).map((r) => (
                          <option key={r} value={r}>
                            {t.roles[r]}
                          </option>
                        ))}
                      </Select>
                      <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-primary hover:bg-surface-2">
                        {t.common.save}
                      </button>
                    </form>
                  ) : (
                    <Badge tone={m.role === "owner" ? "green" : "plain"}>{t.roles[m.role]}</Badge>
                  )}

                  {canInvite && manageable ? (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="userId" value={m.userId} />
                      <ConfirmSubmit message={t.team.removeConfirm}>{t.team.remove}</ConfirmSubmit>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        {canInvite ? (
          <Card className="flex-[2_1_300px]">
            <h2 className="font-display text-lg font-bold">{t.team.inviteTitle}</h2>
            <p className="mt-1 text-sm text-muted">{t.team.inviteHint}</p>
            <InviteForm t={t.team} roles={assignableRoles(ctx.role).map((r) => ({ value: r, label: t.roles[r] }))} />
          </Card>
        ) : null}
      </div>

      {canInvite ? (
        <Card flush>
          <h2 className="px-5 pt-5 font-display text-lg font-bold">{t.team.pending}</h2>
          {pending.length === 0 ? (
            <p className="px-5 pt-1 pb-5 text-sm text-muted">{t.team.noPending}</p>
          ) : (
            <ul className="mt-2">
              {pending.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-4">
                  <div className="flex-[1_1_200px]">
                    <p className="font-semibold">{formatBdPhone(inv.phone)}</p>
                    <p className="text-sm text-muted">
                      {t.team.invitedOn} {dateFmt.format(inv.createdAt)}
                    </p>
                  </div>
                  <Badge tone="warn">{t.roles[inv.role]}</Badge>
                  {canAssign(ctx.role, inv.role) ? (
                    <form action={revokeInviteAction}>
                      <input type="hidden" name="inviteId" value={inv.id} />
                      <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-danger-ink hover:bg-danger-bg">
                        {t.team.revoke}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          {(["owner", "manager", "worker", "vet"] as const).map((r) => (
            <div key={r}>
              <dt className="font-semibold">{t.roles[r]}</dt>
              <dd className="text-sm text-muted">{t.team.roleHelp[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
    </>
  );
}
