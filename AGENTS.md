# AGENTS.md — city-bus-ops

City bus operations system (planning, duties, drivers) for a municipal fixed-route fleet.
Monorepo, TypeScript end to end. **Code, docs, commits and identifiers are English; the
operator-facing UI is Turkish.**

## Layout

| Path | Owns | Must not |
| --- | --- | --- |
| `apps/web` | Next.js App Router: planner, dispatcher, admin, driver PWA at `/driver` | contain business rules — those belong in `packages/domain` |
| `packages/domain` | pure TypeScript entities, value objects, rule engine, rotation law, heuristics | import React, Next, Drizzle or touch the network |
| `packages/db` | Drizzle schema, migrations, seed, GTFS/TODS import-export | contain rule logic |
| `packages/xlsx` | printed-sheet layout and export (template v2.0 cell map) | know about the database |
| `docs/` | design; `legacy-*.md` are frozen records (see `docs/README.md`) | be edited to match new ideas — write a new doc instead |
| `tests/` | cross-package golden files and e2e fixtures | hold application code |

Dependency direction: `web → domain`, `web → db`, `web → xlsx`, `xlsx → domain`, `db → (nothing)`.
`domain` never depends on another workspace package.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm verify` | **the gate**: lint + typecheck + test + build. Everything must pass before "done" |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | single step |
| `pnpm db:generate` | generate a migration from `packages/db/src/schema.ts` |
| `pnpm db:migrate` | apply migrations to `DATABASE_URL` |

## Database

Postgres 17 + PostGIS 3.5 runs as Docker container `citybus-postgres` on the Mint node
(`serverPC`), bound to `127.0.0.1:5435` there. From Windows, open the tunnel first:

```bash
ssh -f -N -L 5435:127.0.0.1:5435 mint     # or: powershell -File scripts/db-tunnel.ps1
```

Credentials live in `.env` (gitignored) and `.secrets/` — never commit them, never paste a
password into a doc, a commit message or a log line.

## Rules

- Read a file before editing it; copy the neighbouring pattern instead of inventing one.
- No `any`, no `@ts-ignore`, no empty `catch`, no silent `return null`. Fix the type.
- Validate at the boundary (HTTP input, Excel cells, imported files); internal code trusts its types.
- No premature abstraction: three similar lines beat a bad helper.
- Bug fix = failing test first, then the fix. New behaviour = acceptance criterion + a test.
- Never weaken a test to get green. If an assertion breaks, understand why before touching it.
- Keep `docs/legacy-*.md` untouched; they are the only record of the rotation law and the
  printed-sheet cell map.
- One change = one purpose. No drive-by formatting, no dependency added without asking.

## Data model boundary

Operational truth lives in our own tables. GTFS Schedule, GTFS-RT and TODS are **generated**
exports; importing them is a migration tool, never an editing path. Anything the standards do
not model (standby, 7-week rotation, extra-duty codes, free-text cell notes) goes in the
documented `x_` extension tables and keeps its raw text (`docs/02-data-model.md`).

## Verification discipline

1. Run `pnpm verify`.
2. Fix what fails, run the same command again.
3. If the same failure survives three rounds, stop and report with two options.
4. If something could not be verified, say so in one line: `not verified: <reason>`.
