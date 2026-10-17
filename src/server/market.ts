import { createHmac } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db/client";
import { isoDate, num, rowsOf } from "@/db/rows";
import { inquiries, listings } from "@/db/schema";
import { normalizeBdPhone } from "@/lib/phone";
import { can } from "@/lib/rbac";
import { err, ok } from "@/lib/result";
import { audit, refDay, zodFields, type Actor } from "./common";

const n0 = (v: unknown) => num(v) ?? 0;

export const CATEGORIES = ["qurbani", "milking_cow", "heifer", "breeding_bull", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const MARKET_SORTS = ["newest", "price_asc", "price_desc", "heaviest"] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];
export const MARKET_PAGE = 18;

export type ListingCard = {
  slug: string;
  title: string;
  category: Category;
  priceTk: number | null;
  negotiable: boolean;
  district: string;
  farm: string;
  upazila: string | null;
  photoUrl: string | null;
  breed: string | null;
  sex: "female" | "male";
  birthDate: string | null;
  weightKg: number | null;
  weighedOn: string | null;
  milkPerDay: number | null;
  vaccinesInDate: number;
  meatWithdrawal: boolean;
  publishedAt: string | null;
};

/**
 * Everything on a listing card comes from the animal's farm records, not from what the seller typed:
 * last weigh-in, milk average, vaccines still in date, and whether a withdrawal period is running.
 */
const cardSelect = sql`
  select l.slug, l.title, l.category::text as category, l.price_tk, l.negotiable, l.district, l.published_at,
    f.name as farm, f.upazila, a.breed_label, a.sex::text as sex, a.birth_date::text as birth_date,
    (select url from animal_media m where m.animal_id = a.id order by is_cover desc, created_at limit 1) as photo_url,
    w.weight_kg::float as weight_kg, w.date::text as weighed_on,
    (select sum(litres)::float / 7 from milk_records mr where mr.animal_id = a.id
       and mr.date > (select max(date) from milk_records where animal_id = a.id) - 7) as milk_per_day,
    (select count(*) from (
        select distinct on (h.vaccine_id) h.next_due_date from health_events h
        where h.animal_id = a.id and h.vaccine_id is not null order by h.vaccine_id, h.date desc
      ) v where v.next_due_date >= current_date)::int as vaccines_in_date,
    exists (select 1 from health_events h where h.animal_id = a.id and h.meat_withdrawal_until >= current_date) as meat_wd
  from listings l
  join animals a on a.id = l.animal_id
  join farms f on f.id = l.farm_id
  left join lateral (select weight_kg, date from weigh_ins wi where wi.animal_id = a.id order by date desc limit 1) w on true
`;

function toCard(r: Record<string, unknown>): ListingCard {
  return {
    slug: String(r.slug),
    title: String(r.title),
    category: r.category as Category,
    priceTk: num(r.price_tk),
    negotiable: Boolean(r.negotiable),
    district: String(r.district),
    farm: String(r.farm),
    upazila: (r.upazila as string | null) ?? null,
    photoUrl: (r.photo_url as string | null) ?? null,
    breed: (r.breed_label as string | null) ?? null,
    sex: r.sex === "male" ? "male" : "female",
    birthDate: isoDate(r.birth_date),
    weightKg: num(r.weight_kg),
    weighedOn: isoDate(r.weighed_on),
    milkPerDay: r.milk_per_day === null || r.milk_per_day === undefined ? null : Math.round(Number(r.milk_per_day) * 10) / 10,
    vaccinesInDate: n0(r.vaccines_in_date),
    meatWithdrawal: Boolean(r.meat_wd),
    publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null,
  };
}

export type MarketFilters = {
  category?: Category;
  district?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: MarketSort;
  page: number;
};

export async function searchListings(db: DB, f: MarketFilters) {
  const where: SQL[] = [sql`l.status = 'active'`, sql`a.lifecycle = 'active'`];
  if (f.category) where.push(sql`l.category = ${f.category}::listing_category`);
  if (f.district) where.push(sql`l.district = ${f.district}`);
  if (f.minPrice) where.push(sql`l.price_tk >= ${f.minPrice}`);
  if (f.maxPrice) where.push(sql`l.price_tk <= ${f.maxPrice}`);
  if (f.q) {
    const like = `%${f.q.trim()}%`;
    where.push(sql`(l.title ilike ${like} or a.breed_label ilike ${like} or f.name ilike ${like})`);
  }
  const order =
    f.sort === "price_asc"
      ? sql`l.price_tk asc nulls last`
      : f.sort === "price_desc"
        ? sql`l.price_tk desc nulls last`
        : f.sort === "heaviest"
          ? sql`w.weight_kg desc nulls last`
          : sql`l.published_at desc nulls last`;
  const cond = sql.join(where, sql` and `);
  const [res, countRes, districtRes] = await Promise.all([
    db.execute(sql`${cardSelect} where ${cond} order by ${order}, l.slug limit ${MARKET_PAGE} offset ${(f.page - 1) * MARKET_PAGE}`),
    db.execute(sql`select count(*)::int as n from listings l join animals a on a.id = l.animal_id join farms f on f.id = l.farm_id where ${cond}`),
    db.execute(sql`select l.district, count(*)::int as n from listings l join animals a on a.id = l.animal_id
      where l.status = 'active' and a.lifecycle = 'active' group by l.district order by l.district`),
  ]);
  return {
    items: rowsOf<Record<string, unknown>>(res).map(toCard),
    total: n0(rowsOf<{ n: number }>(countRes)[0]?.n),
    districts: rowsOf<{ district: string; n: number }>(districtRes).map((d) => ({ district: d.district, n: n0(d.n) })),
  };
}

/** Counts per category for the market's tabs. */
export async function categoryCounts(db: DB) {
  const res = await db.execute(sql`
    select l.category::text as c, count(*)::int as n from listings l join animals a on a.id = l.animal_id
    where l.status = 'active' and a.lifecycle = 'active' group by l.category
  `);
  const out: Record<string, number> = {};
  for (const r of rowsOf<{ c: string; n: number }>(res)) out[r.c] = n0(r.n);
  return out;
}

/** The public listing page: the animal's verified record, as far as it's useful to a buyer. */
export async function getListing(db: DB, slug: string) {
  const res = await db.execute(sql`${cardSelect} where l.slug = ${slug} and l.status in ('active', 'sold')`);
  const row = rowsOf<Record<string, unknown>>(res)[0];
  if (!row) return null;
  const meta = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select l.id, l.status::text as status, l.description, l.farm_id, a.id as animal_id, a.tag, a.name, a.color, a.origin::text as origin,
        a.purchase_date::text as purchase_date, f.created_at::text as farm_since,
        d.tag as dam_tag, d.breed_label as dam_breed,
        coalesce(s.code, sa.tag) as sire_code, coalesce(s.breed_label, sa.breed_label) as sire_breed, s.source as sire_source
      from listings l join animals a on a.id = l.animal_id join farms f on f.id = l.farm_id
      left join animals d on d.id = a.dam_id
      left join sires s on s.id = a.sire_id
      left join animals sa on sa.id = a.sire_animal_id
      where l.slug = ${slug}
    `),
  )[0]!;
  const animalId = String(meta.animal_id);
  const [photos, weights, vaccines, treatments, milk, more] = await Promise.all([
    db.execute(sql`select url, credit, source_url from animal_media where animal_id = ${animalId} order by is_cover desc, created_at`),
    db.execute(sql`select date::text as date, weight_kg::float as kg, method::text as method from weigh_ins where animal_id = ${animalId} order by date`),
    db.execute(sql`
      select distinct on (h.vaccine_id) v.name, v.name_bn, h.date::text as date, h.next_due_date::text as next_due
      from health_events h join vaccines v on v.id = h.vaccine_id
      where h.animal_id = ${animalId} order by h.vaccine_id, h.date desc
    `),
    db.execute(sql`
      select count(*)::int as n, max(meat_withdrawal_until)::text as meat_until, max(milk_withdrawal_until)::text as milk_until
      from health_events where animal_id = ${animalId} and type = 'treatment' and date > current_date - 365
    `),
    db.execute(sql`
      select date::text as date, sum(litres)::float as litres from milk_records
      where animal_id = ${animalId} and date > (select max(date) from milk_records where animal_id = ${animalId}) - 60
      group by date order by date
    `),
    db.execute(sql`${cardSelect} where l.farm_id = ${String(meta.farm_id)} and l.slug <> ${slug} and l.status = 'active' and a.lifecycle = 'active'
      order by l.published_at desc limit 3`),
  ]);
  const t = rowsOf<Record<string, unknown>>(treatments)[0] ?? {};
  return {
    card: toCard(row),
    id: String(meta.id),
    status: String(meta.status) as "active" | "sold",
    description: (meta.description as string | null) ?? null,
    tag: String(meta.tag),
    name: (meta.name as string | null) ?? null,
    color: (meta.color as string | null) ?? null,
    origin: String(meta.origin),
    farmSince: isoDate(meta.farm_since),
    dam: meta.dam_tag ? { tag: String(meta.dam_tag), breed: (meta.dam_breed as string | null) ?? null } : null,
    sire: meta.sire_code ? { code: String(meta.sire_code), breed: (meta.sire_breed as string | null) ?? null, source: (meta.sire_source as string | null) ?? null } : null,
    photos: rowsOf<Record<string, unknown>>(photos).map((p) => ({ url: String(p.url), credit: (p.credit as string | null) ?? null, sourceUrl: (p.source_url as string | null) ?? null })),
    weights: rowsOf<Record<string, unknown>>(weights).map((w) => ({ date: String(w.date), kg: n0(w.kg), method: String(w.method) })),
    vaccines: rowsOf<Record<string, unknown>>(vaccines).map((v) => ({
      name: String(v.name),
      nameBn: (v.name_bn as string | null) ?? null,
      date: String(v.date),
      nextDue: isoDate(v.next_due),
    })),
    treatments: { count: n0(t.n), meatUntil: isoDate(t.meat_until), milkUntil: isoDate(t.milk_until) },
    milk: rowsOf<Record<string, unknown>>(milk).map((m) => ({ date: String(m.date), litres: n0(m.litres) })),
    more: rowsOf<Record<string, unknown>>(more).map(toCard),
  };
}

/* ───────────────────────── Inquiries ───────────────────────── */

const inquiryInput = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().trim().min(2, "required").max(80),
  phone: z.string().trim().min(1, "required").max(20),
  message: z
    .string()
    .trim()
    .max(800)
    .optional()
    .transform((v) => v || null),
  /** Honeypot: people never see this field, bots fill it. */
  website: z.string().max(0, "bot").optional(),
});

const ipKey = () => process.env.OTP_SECRET ?? (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify?.env.get("OTP_SECRET") ?? "dev";
const hashIp = (ip: string) => createHmac("sha256", ipKey()).update(`inq:${ip}`).digest("hex").slice(0, 32);

export const INQUIRY_LIMITS = { perPhonePerHour: 5, perIpPerHour: 10 };

export async function createInquiry(db: DB, input: z.input<typeof inquiryInput>, opts: { ip: string | null; userId: string | null }) {
  const parsed = inquiryInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  const phone = normalizeBdPhone(v.phone);
  if (!phone) return { ...err("invalid" as const), fields: { phone: "phone" } };
  const [listing] = await db
    .select({ id: listings.id, farmId: listings.farmId })
    .from(listings)
    .where(and(eq(listings.slug, v.slug), eq(listings.status, "active")))
    .limit(1);
  if (!listing) return err("not_found" as const);

  const ipHash = opts.ip ? hashIp(opts.ip) : null;
  const recent = rowsOf<{ by_phone: number; by_ip: number; same: number }>(
    await db.execute(sql`
      select
        count(*) filter (where phone = ${phone})::int as by_phone,
        count(*) filter (where ${ipHash}::text is not null and ip_hash = ${ipHash})::int as by_ip,
        count(*) filter (where phone = ${phone} and listing_id = ${listing.id})::int as same
      from inquiries where created_at > now() - interval '1 hour'
    `),
  )[0];
  if ((recent?.same ?? 0) > 0) return err("duplicate" as const);
  if ((recent?.by_phone ?? 0) >= INQUIRY_LIMITS.perPhonePerHour || (recent?.by_ip ?? 0) >= INQUIRY_LIMITS.perIpPerHour) return err("rate_limited" as const);

  await db.insert(inquiries).values({ listingId: listing.id, buyerUserId: opts.userId, name: v.name, phone, message: v.message, ipHash });
  return ok(true);
}

/* ───────────────────────── The farm's side ───────────────────────── */

export async function farmListings(db: DB, farmId: string) {
  const res = await db.execute(sql`
    ${cardSelect}
    where l.farm_id = ${farmId}
    order by case l.status when 'active' then 0 when 'draft' then 1 when 'sold' then 2 else 3 end, l.published_at desc nulls last
  `);
  const extra = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select l.slug, l.id, l.status::text as status, a.tag, a.lifecycle::text as lifecycle,
        (select count(*) from inquiries i where i.listing_id = l.id)::int as inquiries,
        (select count(*) from inquiries i where i.listing_id = l.id and i.status = 'new')::int as new_inquiries
      from listings l join animals a on a.id = l.animal_id where l.farm_id = ${farmId}
    `),
  );
  const by = new Map(extra.map((e) => [String(e.slug), e]));
  return rowsOf<Record<string, unknown>>(res).map((r) => {
    const e = by.get(String(r.slug))!;
    return {
      ...toCard(r),
      id: String(e.id),
      status: String(e.status) as "draft" | "active" | "sold" | "withdrawn",
      tag: String(e.tag),
      lifecycle: String(e.lifecycle),
      inquiries: n0(e.inquiries),
      newInquiries: n0(e.new_inquiries),
    };
  });
}

export async function farmInquiries(db: DB, farmId: string) {
  const res = await db.execute(sql`
    select i.id, i.name, i.phone, i.message, i.status::text as status, i.created_at, l.title, l.slug, a.tag
    from inquiries i join listings l on l.id = i.listing_id join animals a on a.id = l.animal_id
    where l.farm_id = ${farmId}
    order by case i.status when 'new' then 0 when 'replied' then 1 else 2 end, i.created_at desc
    limit 100
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    message: (r.message as string | null) ?? null,
    status: String(r.status) as "new" | "replied" | "closed",
    createdAt: new Date(String(r.created_at)).toISOString(),
    title: String(r.title),
    slug: String(r.slug),
    tag: String(r.tag),
  }));
}

export async function setInquiryStatus(db: DB, actor: Actor, id: string, status: "new" | "replied" | "closed") {
  if (!can(actor.role, "listing.manage")) return err("forbidden" as const);
  const res = await db.execute(sql`
    update inquiries i set status = ${status}::inquiry_status
    from listings l where l.id = i.listing_id and l.farm_id = ${actor.farmId} and i.id = ${id}
    returning i.id
  `);
  if (!rowsOf(res).length) return err("not_found" as const);
  return ok(true);
}

/** Animals that can be listed: active, not already listed, of a kind buyers look for. */
export async function listingCandidates(db: DB, farmId: string) {
  const today = await refDay(db, farmId);
  const res = await db.execute(sql`
    select a.id, a.tag, a.name, a.purpose::text as purpose, a.sex::text as sex, a.breed_label, a.birth_date::text as birth_date,
      (select weight_kg::float from weigh_ins w where w.animal_id = a.id order by date desc limit 1) as kg,
      (select sum(litres)::float / 7 from milk_records m where m.animal_id = a.id and m.date > ${today}::date - 7) as milk
    from animals a
    where a.farm_id = ${farmId} and a.lifecycle = 'active'
      and not exists (select 1 from listings l where l.animal_id = a.id and l.status in ('active', 'draft'))
    order by case a.purpose when 'qurbani' then 1 when 'dairy' then 2 when 'calf' then 3 when 'breeding' then 4 else 5 end, a.tag
  `);
  return rowsOf<Record<string, unknown>>(res).map((r) => {
    const purpose = String(r.purpose);
    const sex = String(r.sex);
    const category: Category =
      purpose === "qurbani" ? "qurbani" : purpose === "dairy" ? "milking_cow" : purpose === "breeding" ? "breeding_bull" : purpose === "calf" && sex === "female" ? "heifer" : "other";
    return {
      id: String(r.id),
      tag: String(r.tag),
      name: (r.name as string | null) ?? null,
      breed: (r.breed_label as string | null) ?? null,
      category,
      kg: num(r.kg),
      milk: r.milk === null || r.milk === undefined ? null : Math.round(Number(r.milk) * 10) / 10,
    };
  });
}

const listingInput = z.object({
  animalId: z.string().uuid("required"),
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(8, "short").max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
  priceTk: z.coerce.number().int().min(1000, "range").max(50_000_000, "range"),
  negotiable: z.coerce.boolean().optional().default(false),
  publish: z.coerce.boolean().optional().default(true),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

export async function createListing(db: DB, actor: Actor, input: z.input<typeof listingInput>) {
  if (!can(actor.role, "listing.manage")) return err("forbidden" as const);
  const parsed = listingInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const v = parsed.data;
  const row = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select a.id, a.tag, a.name, f.district, f.name as farm,
        exists (select 1 from listings l where l.animal_id = a.id and l.status in ('active', 'draft')) as listed,
        exists (select 1 from health_events h where h.animal_id = a.id and h.meat_withdrawal_until >= current_date) as meat_wd
      from animals a join farms f on f.id = a.farm_id
      where a.id = ${v.animalId} and a.farm_id = ${actor.farmId} and a.lifecycle = 'active'
    `),
  )[0];
  if (!row) return { ...err("invalid" as const), fields: { animalId: "required" } };
  if (row.listed) return { ...err("invalid" as const), fields: { animalId: "listed" } };
  // A bull still inside a meat withdrawal period can't be offered for slaughter.
  if (v.publish && v.category === "qurbani" && row.meat_wd) return { ...err("invalid" as const), fields: { animalId: "meat_withdrawal" } };

  const base = slugify(`${row.tag}-${row.name ?? ""}-${row.farm}`) || "listing";
  let slug = base;
  for (let i = 2; (await db.select({ id: listings.id }).from(listings).where(eq(listings.slug, slug)).limit(1)).length; i++) slug = `${base}-${i}`;

  const [created] = await db
    .insert(listings)
    .values({
      farmId: actor.farmId,
      animalId: v.animalId,
      slug,
      category: v.category,
      title: v.title,
      description: v.description,
      priceTk: v.priceTk,
      negotiable: v.negotiable,
      district: String(row.district),
      status: v.publish ? "active" : "draft",
      publishedAt: v.publish ? new Date() : null,
    })
    .returning({ id: listings.id, slug: listings.slug });
  await audit(db, actor, "listing.create", "listing", created!.id, { slug });
  return ok({ slug: created!.slug });
}

const updateInput = z.object({
  title: z.string().trim().min(8, "short").max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
  priceTk: z.coerce.number().int().min(1000, "range").max(50_000_000, "range"),
  negotiable: z.coerce.boolean().optional().default(false),
});

export async function updateListing(db: DB, actor: Actor, id: string, input: z.input<typeof updateInput>) {
  if (!can(actor.role, "listing.manage")) return err("forbidden" as const);
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return { ...err("invalid" as const), fields: zodFields(parsed.error) };
  const res = await db
    .update(listings)
    .set(parsed.data)
    .where(and(eq(listings.id, id), eq(listings.farmId, actor.farmId)))
    .returning({ id: listings.id });
  if (!res.length) return err("not_found" as const);
  await audit(db, actor, "listing.update", "listing", id);
  return ok(true);
}

/** Publish a draft, take a listing down, or put it back up. Selling goes through the animal's exit record. */
export async function setListingStatus(db: DB, actor: Actor, id: string, status: "active" | "withdrawn") {
  if (!can(actor.role, "listing.manage")) return err("forbidden" as const);
  const row = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select l.status::text as status, l.category::text as category, a.lifecycle::text as lifecycle,
        exists (select 1 from health_events h where h.animal_id = a.id and h.meat_withdrawal_until >= current_date) as meat_wd
      from listings l join animals a on a.id = l.animal_id where l.id = ${id} and l.farm_id = ${actor.farmId}
    `),
  )[0];
  if (!row) return err("not_found" as const);
  if (row.status === "sold" || row.lifecycle !== "active") return err("closed" as const);
  if (status === "active" && row.category === "qurbani" && row.meat_wd) return err("meat_withdrawal" as const);
  await db
    .update(listings)
    .set({ status, ...(status === "active" ? { publishedAt: new Date() } : {}) })
    .where(eq(listings.id, id));
  await audit(db, actor, `listing.${status}`, "listing", id);
  return ok(true);
}

