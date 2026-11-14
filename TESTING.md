# TESTING.md

How to exercise this system and which accounts to use. Accounts are demo data: they are
created on the first login attempt (`ensureDemoUsers` in `apps/web/lib/auth.ts`) and the
driver account is linked to the first driver record.

> **Never use these credentials for a real deployment.** Set `CITYBUS_DEMO_PASSWORD` and
> `SESSION_SECRET` in `.env` (`openssl rand -hex 32`), then change the passwords and the
> driver link before the operator starts working with the system.

## Accounts

Password for all four: `CITYBUS_DEMO_PASSWORD` (default `demo1234`).

| E-mail | Role | What it can do |
| --- | --- | --- |
| `admin@kutahya.local` | admin | everything: network, plan, roster, reports |
| `planlama@kutahya.local` | planner | `/network` (routes, stops, timetables), `/plan` (generate, edit, publish) |
| `santral@kutahya.local` | dispatcher | `/plan` (view), `/drivers` (roster, swaps, defects, absences), `/reports` |
| `sofor@kutahya.local` | driver | `/driver` only: my week, swap request, defect report |

Behaviour to expect:

- A driver who opens `/` or `/plan` is redirected to `/driver`.
- A planner who opens `/drivers` gets the roster screen; an anonymous visitor gets `/login`.
- `/api/gtfs` and `/api/health` need no session; `/api/plan/xlsx` does (401 without a cookie).

## Seeded demo data

Created by the first request that resolves the organisation
(`seedReferenceData` in `packages/db/src/seed.ts`), idempotent on every restart:

| Data | Quantity | Note |
| --- | --- | --- |
| Fleet | 45 plates | 41 printed + 4 handwritten (`134`, `186`, `225`, `229`), legacy decision O5 |
| Routes | 12 | `7A 8A 9A 9AT 10A 12A 26A 26B 26E 27A 27B 27E` — codes only, names were never documented |
| Duty groups | 4 | `(6) Toki` g0=3, `(2) F.Şelebi` g0=6, `(5) B.Çukur` g0=1, `(1) Kampüs/Konya` g0=5 |
| Drivers | 20 | `DEMO-01` … `DEMO-20`, names are placeholders |
| Stops | 3 | `S1` Otogar, `S2` Cumhuriyet, `S3` Yeni Mahalle (2 with coordinates) |
| Timetable | 679 trips | route `9A`, 10-minute headway 06:00–22:00, all seven day types, 40-minute trips |

The timetable exists only so the whole chain (blocking → roster → driver app → Excel) can be
walked through; it is not the operator's real schedule.

## Run locally

```bash
pnpm install
cp .env.example .env            # CITYBUS_DB_FILE, SESSION_SECRET, CITYBUS_DEMO_PASSWORD
pnpm --filter @citybus/web dev  # http://localhost:3000
```

SQLite is embedded: the app creates `data/citybus.db`, applies the migrations in
`packages/db/drizzle-sqlite` on boot and seeds reference data on the first request. There is no
tunnel and no database service to start; deleting the file gives a clean install.

`pnpm db:migrate` still exists for applying migrations by hand; `pnpm db:generate` produces the
next migration after a schema change.

## Desktop (Windows) build

```bash
pnpm --filter @citybus/web build          # standalone server
pnpm --filter @citybus/desktop package    # installer + portable exe in apps/desktop/release
pnpm --filter @citybus/desktop self-test  # headless boot check: server + SQLite + health gate
```

The packaged app keeps its data in `%APPDATA%\CityBusOps` (`citybus.db`, `config.json`,
`backups/`, `logs/`). Delete that folder to test a first run.

**No password.** The desktop build sets `CITYBUS_LOCAL_MODE=1`: the app opens on the dashboard and
the sidebar switches the working role (yönetici / planlama / santral / şoför, default admin) via a
`cb_role` cookie. The password login only exists when `CITYBUS_LOCAL_MODE` is unset (web/server
variant). `scripts/smoke.sh` detects which mode it is talking to and switches role with a cookie
instead of a login form.

## End-to-end smoke script

`scripts/smoke.sh` drives the running server the way a browser does (server-action form posts
plus page GETs) and fails loudly when an action, a session or an endpoint breaks:

```bash
BASE=http://127.0.0.1:3000 WEEK=2026-11-23 scripts/smoke.sh
```

It logs in as all three office roles and the driver, generates and publishes the week, runs
the roster, downloads the Excel sheet, and checks the public endpoints and the guards:

```
== planner
  ok   login planlama@kutahya.local
  ok   GET /network (200)
  ok   POST ret (303)                 # generate the week
  info plan: YAT=295 x=8 locked=0
  info rules: no violation
  ok   POST run cutting (303)
  ok   GET /api/plan/xlsx (200)
  ok   POST nla (303)                 # publish
== driver
  ok   driver redirected away from /plan (307)
== public endpoints
  ok   GET /api/gtfs (200)
  ok   GET /api/plan/xlsx without session (401)
SMOKE OK
```

It creates a plan for `WEEK` in whatever database `BASE` points at — use a scratch week when
the operator's real week must stay untouched. `python3`/`python` must be available (the HTML
parsing uses it).

## Automated tests

| Command | Scope |
| --- | --- |
| `pnpm verify` | the gate: lint + typecheck + test + build |
| `pnpm test` | every package; database suites skip without `DATABASE_URL` |
| `pnpm --filter @citybus/domain test` | rotation law, rule engine, generation, blocking, labour rules (79) |
| `pnpm --filter @citybus/gtfs test` | CSV, GTFS read/write, validator, zip (23) |
| `pnpm --filter @citybus/xlsx test` | weekly sheet coordinates and values (10) |
| `pnpm --filter @citybus/db test` | schema shape, migration tables, seed idempotency (9, needs a database) |

`DATABASE_URL=... pnpm test` runs the three database checks that are otherwise skipped.

## Manual walkthrough (10 minutes)

For a human in a browser; the smoke script above covers the same paths without eyes. This is
the flow that was used to verify the build.

1. **Log in as planner** → `/network`. Add a stop (`S9`, "Test Durağı") and a route (`99`).
2. Open `/network/99`, add two stops, then add a Monday trip `06:00`–`06:40`. The stop times
   are spread evenly between the ends.
3. `/plan` with the current week → **Haftayı üret**. Expect the four groups on their rotation
   weekdays (Monday, Wednesday, Friday, Saturday for the default anchor week `2026-09-21`),
   `YAT` for idle vehicles, `x` for the standby vehicle, and a rule panel with no hard
   violation.
4. Edit one cell as `-20` (extra duty) or `12.00` (first departure) → it becomes locked
   (`🔒`), and **Yeniden üret** keeps it.
5. **Yayınla** → status becomes *yayınlandı*; the audit trail on `/reports` records
   `plan.publish`.
6. `/drivers` → **Şoför ata (run cutting)** → 14 roster entries, each with the duty window of
   that vehicle's block. Try an absence for a driver and regenerate: that day gets a
   different driver.
7. **Log in as driver** (`sofor@kutahya.local`) → `/driver`: my week, a swap request form and
   a defect report form. Submit a defect (`003`, "Kapı kapanmıyor").
8. **Log in as dispatcher** (`santral@kutahya.local`) → `/drivers`: the defect is listed as
   *yüksek*; approve or reject the swap request.
9. `/reports` → KPIs, violations, audit rows, and **Haftalık planı Excel olarak indir**
   (`/api/plan/xlsx?week=…`). Open the file: `MATRIS` sheet with the header on row 3, plates
   `B4:B48`, days `C..I`, standby `J`, totals on row 49; plus the `ROTASYON` sheet.
10. `curl -s localhost:3000/api/health` → `{"status":"ok","database":"up"}`; `curl -s
    localhost:3000/api/gtfs -o feed.zip` → unzip and check `trips.txt` is non-empty.

## Reset demo state

```bash
# keep reference data, drop what the walkthrough created
psql "$DATABASE_URL" -c "truncate plan_version cascade; truncate defect_report, swap_request, absence, app_user cascade;"
```

Deleting `plan_version` cascades to assignments, standby, blocks, roster entries, violations
and the plan's audit-free records; the accounts are recreated on the next login.

## Container smoke test

The deployment was verified on the Mint node in a copy of the repository:

```bash
docker compose up -d --build
curl -fsS localhost:3000/api/health      # 200, database up
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login   # 200
```

Migration runs on start; the seed happens on the first request that needs the organisation.
Full results are recorded in `docs/06-deploy.md`.

## Not covered

- **No browser automation.** Playwright/Cypress is not set up; `scripts/smoke.sh` covers the
  request layer of every flow, but a visual or client-side regression (a broken form
  attribute that still parses, a layout break) will only be caught by hand.
- **Optimisation is not tested against the operator's real week.** The generator is
  deterministic and rule-clean on the demo timetable, but only three real historical weeks
  can prove it (see `docs/legacy-data-model-and-scheduler.md` §6.5).
- **No load test.** With 45 vehicles and 679 trips there is nothing to stress; a city with
  thousands of trips per day needs one before it is claimed.
