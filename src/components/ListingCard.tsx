import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { AnimalPhoto } from "@/app/app/animals/AnimalPhoto";
import { Badge } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import { isDemoFarm } from "@/lib/demo";
import { fill, type Fmt } from "@/lib/format";
import type { ListingCard as Card } from "@/server/market";

/** A listing in the public market. The figures under the price come from the farm's records. */
export function ListingCard({ item, t, fmt, today, priority = false }: { item: Card; t: Dictionary; fmt: Fmt; today: string; priority?: boolean }) {
  const m = t.market;
  const facts = [
    item.weightKg ? `${fmt.n(item.weightKg)} ${t.animals.kg}` : null,
    item.milkPerDay ? fill(m.milk, { n: fmt.n(item.milkPerDay, 1) }) : null,
    item.birthDate ? fmt.age(item.birthDate, today, t.animals.ageFmt) : null,
  ].filter(Boolean);
  return (
    <Link
      href={`/market/${item.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink no-underline shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="relative">
        <AnimalPhoto
          url={item.photoUrl}
          alt={item.title}
          noPhotoLabel={t.animals.noPhoto}
          sizes="(min-width: 1240px) 380px, (min-width: 640px) 50vw, 100vw"
          className="aspect-[4/3] w-full"
          priority={priority}
        />
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[13px] font-semibold text-deep shadow-sm">
          {m.categories[item.category]}
        </span>
        {isDemoFarm(item.farm) ? (
          <span className="absolute top-3 right-3 rounded-full bg-[#0f2419]/80 px-2.5 py-1 text-[12px] font-semibold text-white">{m.demo}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-display text-[22px] leading-none font-extrabold tracking-[-0.02em] tabular">
          {fmt.tk(item.priceTk)}
          {item.negotiable ? <span className="ml-2 font-sans text-[13px] font-medium tracking-normal text-muted">{m.negotiable}</span> : null}
        </p>
        <p className="line-clamp-2 text-[16px] leading-snug font-semibold group-hover:text-primary">{item.title}</p>
        {facts.length ? <p className="text-[15px] text-ink-2 tabular">{facts.join(" · ")}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden="true" className="size-3.5" />
            {[item.upazila, item.district].filter(Boolean).join(", ")}
          </span>
          {item.vaccinesInDate ? (
            <span className="inline-flex items-center gap-1 text-primary-ink">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              {item.vaccinesInDate === 1 ? m.vaccines1 : fill(m.vaccines, { n: fmt.n(item.vaccinesInDate) })}
            </span>
          ) : null}
          {item.meatWithdrawal ? <Badge tone="danger">{m.withdrawal}</Badge> : null}
        </div>
      </div>
    </Link>
  );
}
