import type { Metadata } from "next";
import { Card, PageHead, PillTabs } from "@/components/ui";
import { getDb } from "@/db";
import { getDictionary } from "@/i18n";
import { bannerFor } from "@/lib/photos";
import { requirePermission } from "@/server/auth";
import { listingCandidates } from "@/server/market";
import { NewListingForm } from "./NewListingForm";

export const metadata: Metadata = { title: "List an animal" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const [{ locale, t }, ctx, sp] = await Promise.all([getDictionary(), requirePermission("listing.manage"), searchParams]);
  const m = t.market;
  const candidates = await listingCandidates(await getDb(), ctx.farm.id);
  return (
    <>
      <PageHead photo={bannerFor("market")} eyebrow={ctx.farm.name} title={m.tabs.new} subtitle={m.manageSubtitle}>
        <PillTabs
          label={m.manage}
          current="new"
          items={[
            { key: "listings", href: "/app/market", label: m.tabs.listings },
            { key: "inbox", href: "/app/market?tab=inbox", label: m.tabs.inbox },
            { key: "new", href: "/app/market/new", label: m.tabs.new },
          ]}
        />
      </PageHead>
      <div className="page-column pt-6 pb-12">
        <Card className="max-w-2xl">
          <NewListingForm t={m} locale={locale} candidates={candidates} preselect={sp.tag} kg={m.suggestKg} litres={m.suggestLitres} />
        </Card>
      </div>
    </>
  );
}
