import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAnimalAction } from "@/app/actions/animals";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { breedOptions, farmRefDate, formOptions } from "@/server/animals";
import { AnimalForm } from "../AnimalForm";

export const metadata: Metadata = { title: "Add animal" };

export default async function NewAnimalPage() {
  const [{ t }, ctx] = await Promise.all([getDictionary(), requireFarm()]);
  if (!can(ctx.role, "animal.write")) redirect("/app/animals");
  const db = await getDb();
  const [options, breeds, today] = await Promise.all([formOptions(db, ctx.farm.id), breedOptions(db, ctx.farm.id), farmRefDate(db, ctx.farm.id)]);
  const latest = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead title={t.animals.form.newTitle} subtitle={ctx.farm.name} />
      <div className="page-column py-8">
        <div className="max-w-4xl">
          <AnimalForm
            t={t.animals}
            action={createAnimalAction}
            options={{ ...options, breeds }}
            cancelHref="/app/animals"
            today={latest > today ? latest : today}
          />
        </div>
      </div>
    </>
  );
}
