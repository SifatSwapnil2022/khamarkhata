import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { getAnimalProfile } from "@/server/animals";
import { ExitForm } from "./ExitForm";

export const metadata: Metadata = { title: "Record exit" };

export default async function ExitAnimalPage({ params }: { params: Promise<{ tag: string }> }) {
  const [{ t }, ctx, { tag }] = await Promise.all([getDictionary(), requireFarm(), params]);
  const decoded = decodeURIComponent(tag);
  if (!can(ctx.role, "animal.write")) redirect(`/app/animals/${encodeURIComponent(decoded)}`);
  const profile = await getAnimalProfile(await getDb(), ctx.farm.id, decoded);
  if (!profile) notFound();
  if (profile.animal.lifecycle !== "active") redirect(`/app/animals/${encodeURIComponent(profile.animal.tag)}`);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead title={fill(t.animals.form.exitTitle, { tag: profile.animal.tag })} subtitle={profile.animal.name ?? undefined} />
      <div className="page-column py-8">
        <div className="max-w-3xl">
          <ExitForm t={t.animals} tag={profile.animal.tag} today={today} latestWeight={profile.weights.at(-1)?.kg ?? null} />
        </div>
      </div>
    </>
  );
}
