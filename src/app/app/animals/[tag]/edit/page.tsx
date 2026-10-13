import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { updateAnimalAction } from "@/app/actions/animals";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { fill } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requireFarm } from "@/server/auth";
import { breedOptions, formOptions, getAnimalProfile } from "@/server/animals";
import { AnimalForm } from "../../AnimalForm";

export const metadata: Metadata = { title: "Edit animal" };

export default async function EditAnimalPage({ params }: { params: Promise<{ tag: string }> }) {
  const [{ t }, ctx, { tag }] = await Promise.all([getDictionary(), requireFarm(), params]);
  const decoded = decodeURIComponent(tag);
  if (!can(ctx.role, "animal.write")) redirect(`/app/animals/${encodeURIComponent(decoded)}`);
  const db = await getDb();
  const [profile, options, breeds] = await Promise.all([
    getAnimalProfile(db, ctx.farm.id, decoded),
    formOptions(db, ctx.farm.id),
    breedOptions(db, ctx.farm.id),
  ]);
  if (!profile) notFound();
  const a = profile.animal;
  const sire = profile.pedigree.sire.self;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead title={fill(t.animals.form.editTitle, { tag: a.tag })} subtitle={a.name ?? a.breedLabel ?? undefined} />
      <div className="page-column py-8">
        <div className="max-w-4xl">
          <AnimalForm
            t={t.animals}
            action={updateAnimalAction}
            currentTag={a.tag}
            cancelHref={`/app/animals/${encodeURIComponent(a.tag)}`}
            today={today > profile.refDate ? today : profile.refDate}
            options={{ ...options, dams: options.dams.filter((d) => d.tag !== a.tag), bulls: options.bulls.filter((b) => b.tag !== a.tag), breeds }}
            defaults={{
              tag: a.tag,
              name: a.name ?? "",
              nameBn: a.nameBn ?? "",
              sex: a.sex,
              purpose: a.purpose,
              breedLabel: a.breedLabel ?? "",
              breedPercent: a.breedPercent?.toString() ?? "",
              color: a.color ?? "",
              birthDate: a.birthDate ?? "",
              birthDateEstimated: a.birthDateEstimated ? "true" : "",
              origin: a.origin,
              purchaseDate: a.purchaseDate ?? "",
              purchasePriceTk: a.purchasePriceTk?.toString() ?? "",
              purchasedFrom: a.purchasedFrom ?? "",
              damTag: profile.pedigree.dam.self?.kind === "animal" ? profile.pedigree.dam.self.tag : "",
              sireTag: sire ? (sire.kind === "animal" ? sire.tag : sire.code) : "",
              shedId: a.shedId ?? "",
              notes: a.notes ?? "",
            }}
          />
        </div>
      </div>
    </>
  );
}
