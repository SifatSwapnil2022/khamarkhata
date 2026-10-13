# Architecture

## Stack and why

| Concern | Choice | Reason |
|---|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript strict | Server components keep data access on the server; server actions give typed mutations without a separate API layer for the web UI. |
| Styling | Tailwind CSS v4 with tokens as CSS variables | One token set drives light and dark mode; no component-library theme to fight. |
| Database | PostgreSQL via Drizzle ORM | Pedigree (dam/sire links) and event history are relational. Drizzle has no engine binary, generates plain SQL migrations, and the same schema runs on Postgres and PGlite. |
| Local DB | PGlite (Postgres compiled to WASM) | `npm run dev` works with zero setup; tests get a fresh in-memory Postgres per test. Real Postgres via `docker compose up -d`. |
| Hosting | Netlify + Netlify Database | Migrations in `netlify/database/migrations/` are applied by each deploy; deploy previews get their own database branch. |
| Validation | zod | Every server input is parsed before it touches the database. |
| Auth | Phone OTP + database sessions | Most farmers don't use email. See *Auth* below. |
| Tests | Vitest | Business rules are tested against a real Postgres (PGlite), not mocks. |

## Folder structure

```
src/
  app/                  routes (pages, layouts) and server actions
    actions/            "use server" wrappers: read FormData, call a service, revalidate/redirect
    app/                the signed-in farm area (/app, /app/team, /app/settings)
    login/ onboarding/ invites/
  components/           shared UI (ui.tsx primitives, FarmFields, LangToggle)
  db/
    schema.ts           the full data model (all phases)
    client.ts           driver selection: PGlite (dev/test) or Postgres
    index.ts            app-wide handle (server-only)
  i18n/                 en.ts / bn.ts dictionaries, locale detection
  lib/                  pure helpers: phone, rbac, bd (districts, taka), result
  server/               services with the business rules; take a DB handle, no Next imports
    auth.ts             Next glue: current user, farm context, permission guard
netlify/database/migrations/  generated SQL migrations (applied by Netlify on deploy)
scripts/                migrate, seed, reset
tests/                  Vitest suites
```

Rule of thumb: **business logic lives in `src/server/*` and takes `db` as an argument**, so it is testable without Next.js. Server actions are thin.

## Auth

1. User enters a Bangladeshi mobile number. It is normalized to E.164 (`+8801XXXXXXXXX`); Bangla digits are accepted.
2. A 6-digit code is generated with `crypto.randomInt`, stored only as `HMAC-SHA256(OTP_SECRET, phone:code)`, valid for 5 minutes. Requesting a new code invalidates older ones.
3. Limits: 60 s resend cooldown, 3 codes per phone per 10 min, 10 per IP per hour, 5 wrong attempts then the code is burned.
4. On success the code is consumed atomically (so two parallel requests can't both pass), the user is created on first login, and a session is issued.
5. Session: a random 32-byte token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production). Only its SHA-256 hash is stored. 30-day expiry.

SMS goes through `SmsProvider` (`src/server/sms.ts`). The console provider prints codes to the server log; a Bangladeshi SMS gateway plugs in there. `OTP_DEBUG=true` shows the code on screen in development only.

## Multi-tenancy

- Every farm-owned table has `farm_id`. Services take an `Actor { userId, farmId, role }` resolved from the membership, never from client input.
- `requireFarm()` resolves the active farm from the session, falling back to the user's first farm; users without a farm go to `/invites` or `/onboarding`.
- Tests cover cross-farm access (an owner of farm B cannot remove a member of farm A).

## Roles and permissions

Enforced on the server in every action (`requirePermission`). The UI uses the same matrix only to hide controls.

| Permission | Owner | Manager | Worker | Vet |
|---|:-:|:-:|:-:|:-:|
| farm.view | ✓ | ✓ | ✓ | ✓ |
| farm.update | ✓ | ✓ | | |
| farm.delete | ✓ | | | |
| team.view | ✓ | ✓ | | |
| team.invite (and remove) | ✓ | ✓ ¹ | | |
| team.manage (change roles) | ✓ | | | |
| animal.view | ✓ | ✓ | ✓ | ✓ |
| animal.write / animal.delete | ✓ | ✓ | | |
| milk.record | ✓ | ✓ | ✓ | |
| milk.sales | ✓ | ✓ | | |
| health.record | ✓ | ✓ | | ✓ |
| breeding.observe (heat, sickness notes) | ✓ | ✓ | ✓ | |
| breeding.record (service, PD, calving) | ✓ | ✓ | | ✓ |
| weight.record | ✓ | ✓ | ✓ | |
| finance.view / finance.record | ✓ | ✓ | | |
| listing.manage | ✓ | ✓ | | |
| reports.view | ✓ | ✓ | | ✓ |

¹ Managers can invite and remove workers and vets only. Nobody can assign or remove the owner; ownership transfer will be its own flow.

## Data model

Defined in full in `src/db/schema.ts` and reviewed once, before features are built on it.

**Identity and tenancy (phase 1, live):** `users`, `otp_codes`, `sessions`, `farms` (with breeding-rule settings as JSON), `memberships`, `invites` (one pending invite per farm+phone, enforced by a partial unique index), `audit_logs`.

**Catalogs (admin):** `platform_settings` (e.g. each year's Eid ul-Adha date), `breeds`, `vaccines` (platform or farm-specific, with default repeat interval).

**Animals:** `animals` (tag unique per farm, sex, breed + exotic %, birth date with "estimated" flag, origin, `dam_id` / `sire_animal_id` self-references, `sire_id` for AI straws, lifecycle, purpose), `sires`, `sheds`, `animal_media`.

**Events (one timeline per animal):**
- `milk_records`: per milking session, unique per animal/date/session, flags milk under withdrawal
- `breeding_events`: heat, service, pregnancy check, calving, abortion, dry-off
- `health_events`: vaccine, deworming, treatment with milk/meat withdrawal dates, vet visit
- `weigh_ins`: scale or tape, with girth and length

**Business:** `buyers`, `milk_sales`, `feed_logs`, `expenses`, `fattening_plans` (target weight per Eid season), `animal_sales`.

**Marketplace:** `listings` (public slug), `inquiries`, `saved_listings`.

**Reminders:** `notifications` with a `dedupe_key` so the scheduled job never sends the same reminder twice.

`client_id` columns on milk and weigh-in records let the offline PWA retry safely.

## Routes (phase 1)

| Route | Who | Purpose |
|---|---|---|
| `/` | public | Temporary landing (full home page is a later phase) |
| `/login` | public | Phone → OTP |
| `/onboarding` | signed in | Create a farm |
| `/invites` | signed in | Accept/decline invites for this phone |
| `/app` | member | Overview |
| `/app/team` | owner, manager | Members, invites, roles |
| `/app/settings` | member (edit: owner, manager) | Farm details and breeding rules |

Mutations are server actions in `src/app/actions/`. A public REST API (for the marketplace and integrations) is added in the marketplace phase.

## Design system

Tokens are in `src/app/globals.css`, with light and dark values. Type is Archivo for headings and numbers, and Hind Siliguri for body text (it covers both Bangla and Latin). Fonts are self-hosted via `@fontsource`, so the app needs no Google Fonts request at runtime.

Rules: one icon set, real form controls, 44 px touch targets, 4.5:1 text contrast, no gradients or emoji, and no invented numbers. Empty states say what's missing and what comes next.
