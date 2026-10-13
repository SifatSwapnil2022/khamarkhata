# Khamar Khata · খামার খাতা

Farm records for Bangladeshi cattle farms. It covers three segments:

- **Dairy:** daily milk per cow.
- **Breeding:** heat, AI, pregnancy and calving.
- **Qurbani fattening:** weight gain toward a target by Eid.

The goal is that every animal has its full history on record: mother and father, vaccines, treatments, weigh-ins and sale.

> Status: **Phase 1 of 10.** Live today:
> - phone sign-in
> - farms
> - team roles and invites
> - Bangla/English
>
> The full data model for later phases is already in place. Animal records are next.

| Overview | Team and roles | Bangla, mobile |
|---|---|---|
| ![Overview](docs/screenshots/overview.png) | ![Team](docs/screenshots/team.png) | ![Login in Bangla on mobile](docs/screenshots/login-mobile-bn.png) |

## Run it

Requires Node 22.9+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000 and sign in with any Bangladeshi number, such as `01711-111111`. In development the 6-digit code appears on the login screen and in the terminal.

No database setup is needed. Local dev uses PGlite, a full Postgres embedded in the app (stored in `./.data`), and it migrates itself on first start.

Optional demo data:

```bash
npm run db:seed   # owner 01700-000001, manager 01700-000002, pending worker 01700-000003
npm run db:reset  # wipe the local database
```

### Using a real Postgres

```bash
docker compose up -d
# in .env:
DATABASE_URL=postgres://khamar:khamar@localhost:5432/khamar
npm run db:migrate
npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: phone rules, permissions, OTP and session security, team flows, against a real (in-memory) Postgres |
| `npm run lint` / `typecheck` | ESLint, `tsc --noEmit` |
| `npm run db:generate` | Generate a SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and a production build on every push.

## What's in phase 1

- **Phone OTP sign-in:**
  - Bangladeshi number validation (Bangla digits accepted)
  - hashed codes, resend cooldown, per-phone and per-IP limits
  - attempt lockout
  - httpOnly session cookies, with only a hash of the token stored
- **Farms:** onboarding with district (all 64), upazila and segments. A user can belong to several farms and switch between them.
- **Team:**
  - roles: owner, manager, worker, vet
  - invite by phone, accept/decline, change role, remove
  - every change written to an audit log
- **Permissions:** one server-enforced matrix (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#roles-and-permissions)).
- **Settings:** farm details and the breeding rules later phases use for due dates (heat cycle 21 d, PD 75 d, gestation 283 d, dry-off 60 d).
- **Bangla/English toggle.** Locale is detected from the browser and remembered.
- **Light and dark mode.** Mobile-first layouts.

## Roadmap

1. ✅ Setup, auth, farms, roles
2. Animal records: profiles, photos, pedigree (dam/sire), timeline
3. Dairy: offline milk entry, lactation, milk sales
4. Health: vaccines, treatments with withdrawal warnings, reminders
5. Breeding: calendar, sire catalog, inbreeding check
6. Qurbani: weigh-ins, projected weight at Eid, cost per bull
7. Marketplace: listings built from verified records, inquiries, mark sold
8. Analytics dashboard and exports
9. Public home page: video hero and a Three.js farm scene
10. Polish: accessibility, performance, i18n completeness

## Docs

- [Architecture, data model, permissions, auth](docs/ARCHITECTURE.md)
