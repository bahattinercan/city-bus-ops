# 06 — Deploy

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

## Not verified on the development machine

The Windows workstation has no Docker, so the image build was not executed there. Steps to
prove it on the Mint node: `docker compose up -d --build`, then
`curl -fsS localhost:3000/api/health` and a login. Record the result here when it is run.
