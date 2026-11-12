import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createDb, organisations, seedReferenceData, type Database } from '@citybus/db'

export type DbHandle = ReturnType<typeof createDb>

let cached: DbHandle | undefined
let rootEnvLoaded = false

/**
 * The repository root `.env` is the single place secrets live. Next only reads `.env`
 * inside the app directory, and `next.config` runs in a different process than the server
 * worker, so the file is read here, lazily, before the first connection. Real environment
 * variables always win.
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

function handle(): DbHandle {
  if (cached !== undefined) return cached
  loadRootEnv()
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and open the DB tunnel.')
  }
  cached = createDb(url)
  return cached
}

/** Drizzle client for typed queries. */
export function getDb(): Database {
  return handle().db
}

/** Raw postgres.js client, for aggregate queries and health checks. */
export function getSql(): DbHandle['sql'] {
  return handle().sql
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
