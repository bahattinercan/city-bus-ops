# 06 — Deploy (retired)

> **Retired 2026-11-13.** The product is now a Windows desktop application with embedded SQLite
> (`docs/09-desktop-app.md`). The Docker/Postgres path below is kept as a record of the server
> variant and no longer matches the code: the app expects `CITYBUS_DB_FILE`, not `DATABASE_URL`.
> Do not deploy from this document without restoring the Postgres dialect first.


## Target

One deployment per municipality. Postgres + PostGIS and the web app run as two containers on
the Mint node (`serverPC`); Windows machines only use the browser.

| Piece | Where | Note |
| --- | --- | --- |
| `citybus-db` | Docker, `postgis/postgis:17-3.5` | volume `citybus-pgdata`, never exposed to the LAN |
| `citybus-app` | Docker, built from `Dockerfile` | `node:22-slim`, runs migrations on start |
| Reverse proxy | existing host nginx/Caddy | TLS termination, `/api/gtfs` may stay public |

## First deployment

```bash
# on the server
git clone https://github.com/bahattinercan/city-bus-ops.git /srv/citybus
cd /srv/citybus
cp .env.example .env      # fill POSTGRES_PASSWORD, SESSION_SECRET, CITYBUS_DEMO_PASSWORD
openssl rand -hex 32      # value for SESSION_SECRET
docker compose up -d --build
docker compose logs -f app
```

`docker compose` refuses to start when `POSTGRES_PASSWORD`, `SESSION_SECRET` or
`CITYBUS_DEMO_PASSWORD` is missing — a deployment cannot accidentally run with the demo
password.

Migrations run automatically (`pnpm db:migrate` before the server starts). Reference data
(45 plates, 12 routes, 4 duty groups, demo drivers, demo timetable) is seeded on the first
request that needs the organisation.

## Accounts

| Account | Role | Purpose |
| --- | --- | --- |
| `admin@kutahya.local` | admin | everything |
| `planlama@kutahya.local` | planner | network, timetable, weekly plan |
| `santral@kutahya.local` | dispatcher | roster, swaps, defects, reports |
| `sofor@kutahya.local` | driver | driver app (linked to the first driver record) |

All four use `CITYBUS_DEMO_PASSWORD`. **Change the driver link and the passwords before the
operator starts using the system**; the accounts are seeded for the pilot only.

## Backup

`scripts/backup.sh` dumps the database with `pg_dump`, gzips it, verifies the archive and
rotates (14 daily, 8 weekly). Cron on the server:

```
15 3 * * * /srv/citybus/scripts/backup.sh >> /var/log/citybus-backup.log 2>&1
```

Restore:

```bash
gunzip -c /srv/backups/citybus/daily/citybus-<stamp>.sql.gz \
  | docker exec -i citybus-db psql -U citybus -d citybus
```

## Health and monitoring

`GET /api/health` returns `200` with `{status, database, latencyMs}` when the database answers
and `503` otherwise; the container health check uses it.

## Upgrade

```bash
cd /srv/citybus && git pull && docker compose up -d --build
```

Migrations are additive; take a backup first (`scripts/backup.sh`) as with any schema change.

## Verification record

Run on the Mint node (`serverPC`) on 2026-11-12, from a clean copy of the repository
(`git archive HEAD`), with a fresh volume:

| Check | Result |
| --- | --- |
| `docker compose up -d --build` | image built in 65 s, both containers `healthy` |
| `GET /api/health` | `200` `{"status":"ok","database":"up","latencyMs":1}` |
| `GET /login` | `200`, form action posts `303` and sets the session cookie |
| Dashboard after login | `200`, role shown as `planlama` |
| `GET /api/gtfs` | `200`, 156 KB zip generated from the seeded demo timetable |
| Seeded data | 45 vehicles, 12 routes, 679 trips, 20 drivers |

The stack was stopped afterwards (`docker compose down`, volume kept). The Windows
workstation has no Docker, so this was the only environment where the image could be built;
it is recorded here because "it should work" is not evidence.
