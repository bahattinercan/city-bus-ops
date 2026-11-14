import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { sql, type SQL } from 'drizzle-orm'
import { createDb, migrateDb, organisations, seedReferenceData, type Database } from '@citybus/db'

export type DbHandle = ReturnType<typeof createDb>

let cached: DbHandle | undefined
let rootEnvLoaded = false

/**
 * The repository root `.env` is the single place dev settings live. Next only reads `.env`
 * inside the app directory, and `next.config` runs in a different process than the server
 * worker, so the file is read here, lazily, before the first connection. Real environment
 * variables always win — the desktop shell passes everything it needs, so a packaged app
 * never reads a file from disk.
 */
function loadRootEnv(): void {
  if (rootEnvLoaded) return
  rootEnvLoaded = true

  for (const candidate of [join(process.cwd(), '..', '..', '.env'), join(process.cwd(), '.env')]) {
    let content: string
    try {
      content = readFileSync(candidate, 'utf8')
    } catch {
      continue
    }

    for (const line of content.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match === null || match[1] === undefined || match[2] === undefined) continue
      if (process.env[match[1]] !== undefined) continue
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1')
    }
    return
  }
}

/**
 * Where the SQLite file lives. `CITYBUS_DB_FILE` always wins — the desktop shell points it at
 * `%APPDATA%\CityBusOps\citybus.db`; without it the dev default in the repository is used.
 */
function databaseFile(): string {
  const explicit = process.env.CITYBUS_DB_FILE
  if (explicit !== undefined && explicit.trim() !== '') return resolve(explicit.trim())

  return join(process.cwd(), '..', '..', 'data', 'citybus.db')
}

function migrationsFolder(): string {
  const explicit = process.env.CITYBUS_MIGRATIONS_DIR
  if (explicit !== undefined && explicit.trim() !== '') return explicit.trim()
  return join(process.cwd(), '..', '..', 'packages', 'db', 'drizzle-sqlite')
}

function handle(): DbHandle {
  if (cached !== undefined) return cached
  loadRootEnv()

  const file = databaseFile()
  mkdirSync(dirname(file), { recursive: true })
  const opened = createDb(file)
  // A fresh install must work without a manual step; an existing one is left untouched.
  migrateDb(opened.db, migrationsFolder())
  cached = opened
  return cached
}

/** Drizzle client for typed queries. */
export function getDb(): Database {
  return handle().db
}

/** Escape hatch for aggregate queries that read better as SQL. Rows are plain objects. */
export function allRows<T>(query: SQL): T[] {
  return handle().db.all(query) as T[]
}

/** The database file in use, for the settings/backup screen. */
export function databasePath(): string {
  return handle().filePath
}

export const TENANT_SLUG = process.env.CITYBUS_TENANT_SLUG ?? 'kutahya'

export type Organisation = {
  readonly id: string
  readonly name: string
  readonly rotationAnchorWeek: string
}

/**
 * Resolves the current organisation and seeds reference data on first use, so a fresh
 * database becomes usable without a manual step in the browser session.
 */
export async function getOrganisation(): Promise<Organisation> {
  const db = getDb()
  const rows = await db.select().from(organisations)
  const found = rows.find((row) => row.slug === TENANT_SLUG)
  if (found !== undefined) {
    return { id: found.id, name: found.name, rotationAnchorWeek: found.rotationAnchorWeek }
  }

  const { organisationId } = await seedReferenceData(handle())
  return { id: organisationId, name: 'Kütahya Şehir İçi Ulaşım', rotationAnchorWeek: '2026-09-21' }
}

/** Kept for the health check: proves a round trip without pulling a table. */
export function pingDatabase(): boolean {
  const [row] = allRows<{ ok: number }>(sql`select 1 as ok`)
  return row?.ok === 1
}
