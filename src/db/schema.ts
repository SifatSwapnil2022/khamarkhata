/**
 * Khamar Khata — full database schema.
 *
 * Phase 1 uses: users, otp_codes, sessions, farms, memberships, invites, audit_logs.
 * The rest is the agreed model for later phases, defined now so the shape is reviewed once.
 *
 * Conventions
 * - Every farm-owned row carries farm_id; every query must filter by it.
 * - Money is whole taka (integer). Litres and kilograms are numeric.
 * - Records are events (milk, breeding, health, weigh-in) so an animal's profile is one timeline.
 * - client_id columns let the offline PWA retry a write without creating duplicates.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const farmRef = () =>
  uuid()
    .notNull()
    .references(() => farms.id, { onDelete: "cascade" });

/* ───────────────────────── Enums ───────────────────────── */

export const roleEnum = pgEnum("role", ["owner", "manager", "worker", "vet"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "declined", "revoked"]);
export const segmentEnum = pgEnum("segment", ["dairy", "breeding", "qurbani"]);
export const speciesEnum = pgEnum("species", ["cattle", "buffalo", "goat", "sheep"]);
export const sexEnum = pgEnum("sex", ["female", "male"]);
export const originEnum = pgEnum("origin", ["born", "purchased"]);
export const lifecycleEnum = pgEnum("lifecycle", ["active", "sold", "dead", "culled"]);
export const purposeEnum = pgEnum("purpose", ["dairy", "breeding", "qurbani", "calf", "other"]);
export const milkSessionEnum = pgEnum("milk_session", ["am", "pm"]);
export const buyerKindEnum = pgEnum("buyer_kind", ["collector", "sweet_shop", "direct", "other"]);
export const breedingTypeEnum = pgEnum("breeding_type", [
  "heat",
  "service",
  "pregnancy_check",
  "calving",
  "abortion",
  "dry_off",
]);
export const serviceMethodEnum = pgEnum("service_method", ["ai", "natural"]);
export const pdResultEnum = pgEnum("pd_result", ["positive", "negative", "uncertain"]);
export const calvingEaseEnum = pgEnum("calving_ease", ["normal", "assisted", "difficult", "caesarean"]);
export const healthTypeEnum = pgEnum("health_type", [
  "vaccine",
  "deworming",
  "treatment",
  "vet_visit",
  "observation",
]);
export const weighMethodEnum = pgEnum("weigh_method", ["scale", "tape"]);
export const expenseCategoryEnum = pgEnum("expense_category", [
  "feed",
  "medicine",
  "vet",
  "labour",
  "utilities",
  "transport",
  "equipment",
  "animal_purchase",
  "other",
]);
export const listingCategoryEnum = pgEnum("listing_category", [
  "qurbani",
  "milking_cow",
  "heifer",
  "breeding_bull",
  "other",
]);
export const listingStatusEnum = pgEnum("listing_status", ["draft", "active", "sold", "withdrawn"]);
export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "replied", "closed"]);

/* ─────────────────── Identity & tenancy (phase 1) ─────────────────── */

export const users = pgTable("users", {
  id: id(),
  /** E.164, e.g. +8801712345678 */
  phone: text().notNull().unique(),
  name: text(),
  email: text(),
  locale: text().notNull().default("bn"),
  isSuperAdmin: boolean().notNull().default(false),
  createdAt: createdAt(),
  lastLoginAt: timestamp({ withTimezone: true }),
});

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    phone: text().notNull(),
    /** HMAC-SHA256 of phone:code. The code itself is never stored. */
    codeHash: text().notNull(),
    ip: text(),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.phone, t.createdAt), index().on(t.ip, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeFarmId: uuid().references(() => farms.id, { onDelete: "set null" }),
    userAgent: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

export type FarmSettings = {
  heatCycleDays: number;
  pregnancyCheckDays: number;
  gestationDays: number;
  dryOffDaysBeforeCalving: number;
  milkUnitPriceTk: number | null;
};

export const DEFAULT_FARM_SETTINGS: FarmSettings = {
  heatCycleDays: 21,
  pregnancyCheckDays: 75,
  gestationDays: 283,
  dryOffDaysBeforeCalving: 60,
  milkUnitPriceTk: null,
};

export const farms = pgTable("farms", {
  id: id(),
  name: text().notNull(),
  district: text().notNull(),
  upazila: text(),
  segments: segmentEnum().array().notNull(),
  settings: jsonb().$type<FarmSettings>().notNull().default(DEFAULT_FARM_SETTINGS),
  createdById: uuid()
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    farmId: farmRef(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.farmId, t.userId), index().on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    farmId: farmRef(),
    phone: text().notNull(),
    role: roleEnum().notNull(),
    invitedById: uuid()
      .notNull()
      .references(() => users.id),
    status: inviteStatusEnum().notNull().default("pending"),
    createdAt: createdAt(),
    respondedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("invites_one_pending_per_phone")
      .on(t.farmId, t.phone)
      .where(sql`${t.status} = 'pending'`),
    index().on(t.phone, t.status),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    farmId: uuid().references(() => farms.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    data: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.farmId, t.createdAt)],
);

/* ───────────────────── Platform catalogs (admin) ───────────────────── */

export const platformSettings = pgTable("platform_settings", {
  /** e.g. "eid_ul_adha:2027" → { date: "2027-05-16", confirmed: false } */
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const breeds = pgTable("breeds", {
  id: id(),
  species: speciesEnum().notNull(),
  name: text().notNull(),
  nameBn: text(),
  isLocal: boolean().notNull().default(false),
});

export const vaccines = pgTable("vaccines", {
  id: id(),
  /** null = platform catalog; otherwise a farm's custom entry */
  farmId: uuid().references(() => farms.id, { onDelete: "cascade" }),
  species: speciesEnum().notNull().default("cattle"),
  name: text().notNull(),
  nameBn: text(),
  isDeworming: boolean().notNull().default(false),
  defaultIntervalDays: integer().notNull(),
});

/* ───────────────────────── Animals (phase 2) ───────────────────────── */

export const sheds = pgTable("sheds", {
  id: id(),
  farmId: farmRef(),
  name: text().notNull(),
  createdAt: createdAt(),
});

/** External sires: AI semen straws. A farm's own bulls are rows in `animals`. */
export const sires = pgTable("sires", {
  id: id(),
  farmId: farmRef(),
  code: text().notNull(),
  name: text(),
  breedLabel: text(),
  source: text(),
  notes: text(),
  createdAt: createdAt(),
});

export const animals = pgTable(
  "animals",
  {
    id: id(),
    farmId: farmRef(),
    tag: text().notNull(),
    govtId: text(),
    name: text(),
    nameBn: text(),
    species: speciesEnum().notNull().default("cattle"),
    sex: sexEnum().notNull(),
    breedId: uuid().references(() => breeds.id),
    /** Free-text label shown to people, e.g. "HF × Local" */
    breedLabel: text(),
    /** Exotic blood %, e.g. 75 for a 75% Holstein Friesian cross */
    breedPercent: integer(),
    color: text(),
    birthDate: date(),
    birthDateEstimated: boolean().notNull().default(false),
    origin: originEnum().notNull(),
    purchaseDate: date(),
    purchasePriceTk: integer(),
    purchasedFrom: text(),
    damId: uuid().references((): AnyPgColumn => animals.id, { onDelete: "set null" }),
    sireAnimalId: uuid().references((): AnyPgColumn => animals.id, { onDelete: "set null" }),
    sireId: uuid().references(() => sires.id, { onDelete: "set null" }),
    shedId: uuid().references(() => sheds.id, { onDelete: "set null" }),
    purpose: purposeEnum().notNull(),
    lifecycle: lifecycleEnum().notNull().default("active"),
    exitDate: date(),
    exitReason: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex().on(t.farmId, t.tag),
    index().on(t.farmId, t.lifecycle),
    index().on(t.damId),
    index().on(t.sireAnimalId),
  ],
);

export const animalMedia = pgTable("animal_media", {
  id: id(),
  farmId: farmRef(),
  animalId: uuid()
    .notNull()
    .references(() => animals.id, { onDelete: "cascade" }),
  url: text().notNull(),
  kind: text().notNull().default("photo"),
  isCover: boolean().notNull().default(false),
  createdAt: createdAt(),
});

/* ───────────────────────── Dairy (phase 3) ───────────────────────── */

export const milkRecords = pgTable(
  "milk_records",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    date: date().notNull(),
    session: milkSessionEnum().notNull(),
    litres: numeric({ precision: 5, scale: 2 }).notNull(),
    /** Set when the cow was under a milk withdrawal period; this milk must not be sold. */
    underWithdrawal: boolean().notNull().default(false),
    clientId: text().unique(),
    recordedById: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.animalId, t.date, t.session), index().on(t.farmId, t.date)],
);

export const buyers = pgTable("buyers", {
  id: id(),
  farmId: farmRef(),
  name: text().notNull(),
  phone: text(),
  kind: buyerKindEnum().notNull(),
  createdAt: createdAt(),
});

export const milkSales = pgTable(
  "milk_sales",
  {
    id: id(),
    farmId: farmRef(),
    buyerId: uuid().references(() => buyers.id, { onDelete: "set null" }),
    date: date().notNull(),
    litres: numeric({ precision: 7, scale: 2 }).notNull(),
    pricePerLitreTk: numeric({ precision: 7, scale: 2 }).notNull(),
    amountTk: integer().notNull(),
    paidTk: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.farmId, t.date)],
);

/* ───────────────────────── Health (phase 4) ───────────────────────── */

export const healthEvents = pgTable(
  "health_events",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    type: healthTypeEnum().notNull(),
    date: date().notNull(),
    vaccineId: uuid().references(() => vaccines.id),
    batchNo: text(),
    diagnosis: text(),
    drug: text(),
    dose: text(),
    vetName: text(),
    milkWithdrawalUntil: date(),
    meatWithdrawalUntil: date(),
    nextDueDate: date(),
    costTk: integer(),
    notes: text(),
    recordedById: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.farmId, t.nextDueDate), index().on(t.animalId, t.date)],
);

/* ───────────────────────── Breeding (phase 5) ───────────────────────── */

export const breedingEvents = pgTable(
  "breeding_events",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    type: breedingTypeEnum().notNull(),
    date: date().notNull(),
    method: serviceMethodEnum(),
    sireId: uuid().references(() => sires.id, { onDelete: "set null" }),
    sireAnimalId: uuid().references(() => animals.id, { onDelete: "set null" }),
    technician: text(),
    pdResult: pdResultEnum(),
    calvingEase: calvingEaseEnum(),
    calfId: uuid().references(() => animals.id, { onDelete: "set null" }),
    notes: text(),
    recordedById: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.animalId, t.date), index().on(t.farmId, t.type, t.date)],
);

/* ───────────────────── Growth & Qurbani (phase 6) ───────────────────── */

export const weighIns = pgTable(
  "weigh_ins",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    date: date().notNull(),
    weightKg: numeric({ precision: 6, scale: 1 }).notNull(),
    method: weighMethodEnum().notNull(),
    heartGirthCm: numeric({ precision: 5, scale: 1 }),
    bodyLengthCm: numeric({ precision: 5, scale: 1 }),
    bodyConditionScore: numeric({ precision: 2, scale: 1 }),
    clientId: text().unique(),
    recordedById: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.animalId, t.date)],
);

export const fatteningPlans = pgTable(
  "fattening_plans",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    seasonYear: integer().notNull(),
    startDate: date().notNull(),
    startWeightKg: numeric({ precision: 6, scale: 1 }).notNull(),
    targetWeightKg: numeric({ precision: 6, scale: 1 }).notNull(),
    pricePerKgTk: integer(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.animalId, t.seasonYear)],
);

/* ─────────────────── Feed, costs & sales (phases 3–7) ─────────────────── */

export const feedLogs = pgTable("feed_logs", {
  id: id(),
  farmId: farmRef(),
  date: date().notNull(),
  shedId: uuid().references(() => sheds.id, { onDelete: "set null" }),
  animalId: uuid().references(() => animals.id, { onDelete: "set null" }),
  item: text().notNull(),
  quantityKg: numeric({ precision: 8, scale: 2 }).notNull(),
  costTk: integer(),
  createdAt: createdAt(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    farmId: farmRef(),
    date: date().notNull(),
    category: expenseCategoryEnum().notNull(),
    amountTk: integer().notNull(),
    animalId: uuid().references(() => animals.id, { onDelete: "set null" }),
    shedId: uuid().references(() => sheds.id, { onDelete: "set null" }),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.farmId, t.date)],
);

export const animalSales = pgTable("animal_sales", {
  id: id(),
  farmId: farmRef(),
  animalId: uuid()
    .notNull()
    .references(() => animals.id, { onDelete: "cascade" }),
  listingId: uuid().references((): AnyPgColumn => listings.id, { onDelete: "set null" }),
  date: date().notNull(),
  buyerName: text(),
  buyerPhone: text(),
  priceTk: integer().notNull(),
  weightKg: numeric({ precision: 6, scale: 1 }),
  notes: text(),
  createdAt: createdAt(),
});

/* ───────────────────────── Marketplace (phase 7) ───────────────────────── */

export const listings = pgTable(
  "listings",
  {
    id: id(),
    farmId: farmRef(),
    animalId: uuid()
      .notNull()
      .references(() => animals.id, { onDelete: "cascade" }),
    slug: text().notNull().unique(),
    category: listingCategoryEnum().notNull(),
    title: text().notNull(),
    description: text(),
    priceTk: integer(),
    negotiable: boolean().notNull().default(true),
    district: text().notNull(),
    status: listingStatusEnum().notNull().default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.status, t.category, t.district)],
);

export const inquiries = pgTable("inquiries", {
  id: id(),
  listingId: uuid()
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  buyerUserId: uuid().references(() => users.id, { onDelete: "set null" }),
  name: text().notNull(),
  phone: text().notNull(),
  message: text(),
  status: inquiryStatusEnum().notNull().default("new"),
  createdAt: createdAt(),
});

export const savedListings = pgTable(
  "saved_listings",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/* ───────────────────────── Reminders (phase 4+) ───────────────────────── */

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    farmId: uuid().references(() => farms.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    title: text().notNull(),
    body: text(),
    href: text(),
    dueDate: date(),
    /** Stops the reminder job from creating the same notification twice. */
    dedupeKey: text().notNull().unique(),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.readAt)],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type Segment = (typeof segmentEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type Farm = typeof farms.$inferSelect;
