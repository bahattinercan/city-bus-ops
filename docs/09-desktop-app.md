# 09 — Desktop (Windows) plan

Target: the same product, installed on a Windows machine, running **locally** — no browser, no
server to administer.

**Status: implemented (P0–P4), see "Delivered" at the end.** The decisions below are the ones the
operator locked in on 2026-11-13.

## What already carries over

The monorepo was built so that the rules never touch the framework. That is what makes this
migration affordable.

| Piece | Portability | Notes |
| --- | --- | --- |
| `packages/domain` (rule engine R1–R18, L1–L5, rotation law, run cutting, cell grammar) | **100 % as-is** | pure TypeScript, 103 tests, no React/DB/network |
| `packages/xlsx` (printed sheet, template v2.0 cell map) | **100 % as-is** | `exceljs` is pure JS |
| `packages/gtfs` (GTFS read/write) | **100 % as-is** | no Node-only imports in src |
| `apps/web` UI (12 routes, server actions, planetary-service design system) | **95 %** | the pages stay; only the shell and the data layer change |
| `packages/db` (Drizzle schema + 5 migration files + 5 raw SQL blocks) | **rework** | Postgres → SQLite: see below |
| Auth (`cb_session` HMAC cookie, 4 roles) | shrink | a local install is one workstation; roles stay useful for shared-PC shifts |

Facts measured in the repo today:

- **No PostGIS in code.** Only `client.integration.test.ts` checks that the extension exists, and
  a comment says geometry arrives with the future map editor. A plain embedded database is enough.
- **Five raw SQL blocks** in `apps/web` (`::text`, `::int`, `now()`), everything else is Drizzle.
- `next.config.ts` does not set `output`; the desktop build needs `output: 'standalone'`.

## Architecture options

| # | Shape | Installer size | Work | Verdict |
| --- | --- | --- | --- | --- |
| **A** | **Electron shell + existing Next server (standalone) + SQLite** | 130–170 MB | 2–3 weeks | **Recommended** — keeps every screen, every server action and the whole rule engine; no rewrite |
| B | Tauri v2 shell + Node sidecar (same Next server) | 90–130 MB (the Node/Next sidecar dominates) | 3–4 weeks | smaller shell, but two runtimes + a Rust toolchain to maintain; wins little |
| C | Tauri (or WPF/MAUI) + domain rewritten in Rust/.NET | 15–30 MB | 2–4 months | rewrites the only part that is already correct and tested; rejected |

### Option A in one picture

```
city-bus-ops.exe (Electron main)
├── picks a free port, ensures %APPDATA%\CityBusOps\
├── spawns: ELECTRON_RUN_AS_NODE=1 node server.js   (Next standalone, 127.0.0.1 only)
│     └── sqlite file: %APPDATA%\CityBusOps\citybus.db  (WAL)
├── waits for GET /api/health == 200
├── BrowserWindow -> http://127.0.0.1:<port>   (no URL bar, no tabs)
└── on quit: tells the server to close, checkpoints WAL, exits
```

## Data layer: SQLite instead of Postgres

| Postgres today | SQLite target |
| --- | --- |
| `uuid` PK + `defaultRandom()` | `text` PK, id generated in code (`crypto.randomUUID()`) |
| `timestamptz` | `integer` (unix ms) or `text` ISO — one choice, applied everywhere |
| `boolean` | `integer` 0/1 (Drizzle `{ mode: 'boolean' }`) |
| `jsonb` (audit payload, rule metadata) | `text` + `JSON.parse` at the boundary |
| `date` (week_start, absences) | `text` `YYYY-MM-DD` (already string-typed in the code) |
| `::text` / `::int` casts, `now()` | dropped: values returned as numbers/strings, timestamps set in code |
| 5 migration files (Postgres SQL) | one fresh SQLite baseline via `drizzle-kit generate --dialect sqlite`; Postgres migrations stay in git for the server variant |
| 5 raw `getSql()` blocks | rewritten as Drizzle queries or `sql` template with SQLite syntax |

Driver: `better-sqlite3` (synchronous, single-file, WAL). Native module → must be rebuilt for
Electron's ABI (`@electron/rebuild`); running it in a plain Node child process instead would mean
shipping a second runtime.

**One-time data import** (only if the pilot data matters): a script reads the current Postgres and
writes the SQLite file through the same Drizzle schema — no GTFS/Excel round-trip needed.

## Phases, each with a gate

| Phase | Content | Gate (proof) |
| --- | --- | --- |
| **P0 — spike (1–2 d)** | `output: 'standalone'`; start the server from a folder without the monorepo; open it in a window | `node server.js` serves `/login`; a bare Electron window shows it; app closes cleanly |
| **P1 — data layer (3–5 d)** | SQLite schema, migrations, driver swap, 5 raw queries rewritten, `getDb()` abstraction | `pnpm verify` green; the DB integration tests run against SQLite; `pnpm test` covers plan generate + roster on SQLite |
| **P2 — shell (2–3 d)** | Electron main: free port, health wait, single-instance lock, window state, menu (Türkçe), error dialog when the server dies, graceful shutdown | app opens `/` → `/login` → `/plan` on a machine with no browser; killing the server shows a readable error, not a white screen |
| **P3 — packaging (2–3 d)** | `electron-builder`: NSIS installer + portable `.exe`, icon, per-user install, `%APPDATA%` data dir, `@electron/rebuild` for `better-sqlite3` | installer runs on a clean Windows VM: install → first launch → plan generate → Excel export → uninstall leaves `%APPDATA%` intact |
| **P4 — parity + import (2–3 d)** | data import script, backups (copy db file + `*-wal`), GTFS zip + Excel export from the packaged app, Turkish locale/timezone checks | smoke script (adapted to `127.0.0.1:<port>`) passes against the installed app |
| **P5 — hardening (2–3 d)** | code signing (SmartScreen), auto-update decision, log file in `%APPDATA%`, crash handling, first-run wizard (organisation name, rotation anchor) | a signed installer installs without a SmartScreen warning; logs exist after a forced crash |

Total ≈ **2–3 weeks** for one workstation, feature-parity.

## Risks and traps

1. **Native module ABI** — `better-sqlite3` compiled for Node ≠ Electron. Rebuild per Electron
   version; the alternative (a separate `node.exe`) costs ~80 MB and a second runtime to patch.
2. **Server actions need a live HTTP server.** The window must load `http://127.0.0.1:<port>`, not
   `file://`. Static export would force every mutation through IPC — a rewrite, not a port.
3. **Port collisions / firewalls** — pick a free port at runtime, bind `127.0.0.1` only, never
   `0.0.0.0` (Windows Firewall prompts would scare operators).
4. **Antivirus / SmartScreen** — an unsigned NSIS installer is blocked or warned; signing must be
   planned early, not at the end.
5. **Backups are now the operator's job** — a local app must write a rotating copy of the `.db`
   file on start and on quit, and show the folder in the UI.
6. **Turkish locale** — date/time formatting must not follow the OS locale; the app already uses
   `Europe/Istanbul` and ISO strings, keep it that way inside the packaged runtime.
7. **Multi-user is not free.** A local install is one workstation. If planner + dispatcher work on
   different PCs, the product needs a "host mode" (one PC serves the LAN, others use their
   browser, exactly the current Next build) or a shared server — this decision shapes P1.

## Decision record — 2026-11-13

| Question | Decision | Consequence |
| --- | --- | --- |
| Architecture | **Electron + existing Next server (standalone)** | every screen, server action and the rule engine survive untouched; the work is shell + data layer |
| Data | **SQLite embedded** (`better-sqlite3`, WAL, `%APPDATA%\CityBusOps\citybus.db`) | schema port as in the table above; no service to install |
| Usage | **single workstation** | no host mode, no LAN binding, no multi-writer conflict handling; the DB file is the installation's state |
| First release | **full parity** (12 screens, Excel, GTFS) | P4 data import becomes optional (only to carry pilot data over), not a prerequisite |

Consequences that follow from "single workstation":

- **No login, no password.** The operator is already sitting at the machine, so a password proves
  nothing and a per-install generated password only creates support calls. The app opens straight
  on the dashboard; the sidebar has a **role switch** (yönetici / planlama / santral / şoför) kept
  in a `cb_role` cookie, default admin. The account rows still exist so foreign keys and the audit
  trail stay valid, and the web/server variant keeps the password flow (`CITYBUS_LOCAL_MODE` unset).
- **`/driver` becomes a hand-off screen.** Drivers do not install anything: the week is printed or
  exported from this machine. The screen stays (it is the printable view) and the swap/defect
  actions keep working for whoever sits at the PC.
- **Backups are automated, not delegated.** On start and on quit the app writes
  `backups\citybus-YYYY-MM-DD-HHmm.db` (keep 14) and shows the folder in a menu item.
- **No auto-update in v1.** The installer is handed out manually; signing is a separate decision.
- **Ports and firewall**: bind `127.0.0.1` only, free port chosen at runtime — no Windows Firewall
  prompt, no LAN exposure.

## P0 checklist (approved and done)

New dependencies (nothing else is added):

| Package | Scope | Why |
| --- | --- | --- |
| `electron` | dev | the shell |
| `electron-builder` | dev | NSIS installer + portable exe |
| `better-sqlite3` | `packages/db` | SQLite driver |
| `@electron/rebuild` | dev | rebuild the native module for Electron's ABI |
| `drizzle-orm/better-sqlite3` | (already in `drizzle-orm`) | dialect driver |
| `drizzle-kit` (sqlite dialect) | dev (already present) | generate the SQLite baseline |

Steps, in order:

1. `next.config.ts`: add `output: 'standalone'`; `pnpm build`; confirm
   `apps/web/.next/standalone/apps/web/server.js` exists and serves `/login` with
   `PORT=<free> HOSTNAME=127.0.0.1 node server.js` from a copied folder.
2. `apps/desktop/` workspace package: `main.ts` (single instance, free port, spawn with
   `ELECTRON_RUN_AS_NODE=1`, poll `/api/health`, `BrowserWindow`, graceful quit), `preload.ts`
   (nothing but a version string), `electron-builder.yml`.
3. Prove the spike: window shows the login screen on a machine with the server process killed
   behind it, and a readable Turkish error when the server dies.

Gate for starting P1: step 3 passes on Windows and `pnpm verify` stays green (the web build must
not regress).

## Delivered

| Phase | Result |
| --- | --- |
| P0 | `output: 'standalone'`; the server runs from a copied folder with no monorepo around it |
| P1 | SQLite is the single dialect: schema, one generated baseline (`packages/db/drizzle-sqlite`), `better-sqlite3` driver, 5 raw SQL blocks rewritten, migrations applied by the app on boot, **146 tests green with no skips** (the DB tests now run on a temp SQLite file instead of skipping) |
| P2 | `apps/desktop`: single-instance lock, free loopback port, health gate, Turkish menu (backup, data folder, credentials, guide), window-state memory, readable error window, logs in `%APPDATA%\CityBusOps\logs`, graceful shutdown, `--self-test` for headless verification |
| P3 | electron-builder: **NSIS installer 103 MB**, **portable exe 93 MB** (staged server 66 MB inside `resources/server`) |
| P4 | rotating backups on start and quit (14 kept), **no password**: the app boots into the dashboard and the sidebar switches role, full smoke suite green against the packaged resources |

Measured on this machine (Electron 38.8.6, Windows 11, Node 22):

```text
pnpm --filter @citybus/desktop self-test
{"selfTest":"ok","port":54229,"database":"...\AppData\Roaming\CityBusOps\citybus.db", ...}

BASE=http://127.0.0.1:<port> WEEK=2026-11-16 scripts/smoke.sh   → SMOKE OK
```

### Packaging traps that were real (and how they are handled)

1. **Native module ABI.** Electron 38 needs `NODE_MODULE_VERSION` 139; the traced binary is built
   for plain Node (127). `scripts/prepare-server.mjs` downloads the vendor's prebuilt
   `better-sqlite3-v<version>-electron-v<abi>-win32-x64.tar.gz` and swaps it in — no Visual Studio
   build tools, and the repo keeps the plain-Node build for `pnpm test`.
2. **File tracing gaps.** Next's standalone output misses packages it `require`s dynamically:
   `@swc/helpers`, `@next/env`, and (only visible after packaging, when the repo is no longer
   above the app) `bindings` + `file-uri-to-path` for `better-sqlite3`. All four are copied
   explicitly and verified by the smoke suite running against `release/win-unpacked/resources`.
3. **Unsigned builds are blocked by Windows.** On this machine Smart App Control refused to start
   the freshly built `City Bus Ops.exe` ("Uygulama Denetimi ilkesi bu dosyayı engelledi"). The same
   bytes run fine through the dev Electron binary, so the build is correct — but **shipping to an
   operator requires a code-signing certificate**; that is a release gate, not a code change.
4. **`next start` vs standalone.** `pnpm start` (plain `next start`) still works inside the repo but
   Next warns that a standalone build should be served by `node .next/standalone/apps/web/server.js`.
   The desktop shell does exactly that.

### Still open (release checklist, not code)

- Code-signing certificate (above) and therefore a SmartScreen-clean installer.
- Branded `.ico` (v1 uses the default Electron icon).
- Auto-update channel: deferred on purpose; upgrades are manual installers for now.
- First-run wizard for organisation name and rotation anchor (today `config.json` holds the
  defaults and the app menu shows them).
- The role switch is the whole access model: if the depot ever needs real separation between
  planner and dispatcher, that is the web/server variant, not this build.
- Optional: migrate a pilot Postgres database into the SQLite file (the import script is not
  written; for a fresh municipality there is nothing to import).
