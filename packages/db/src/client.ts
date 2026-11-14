import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type Database = ReturnType<typeof createDb>['db']

/**
 * Opens the desktop database file. SQLite is embedded, so there is no pool to babysit: the
 * handle owns one connection and the caller closes it on shutdown.
 *
 * `journal_mode=WAL` keeps reads fast while a write is in flight and survives a hard kill;
 * `foreign_keys=ON` is off by default in SQLite and we depend on the cascade rules.
 */
export function createDb(filePath: string) {
  if (!filePath) {
    throw new Error('database file path is not set')
  }

  const raw = new Database(filePath)
  raw.pragma('journal_mode = WAL')
  raw.pragma('foreign_keys = ON')
  const db = drizzle(raw, { schema })

  return {
    db,
    raw,
    filePath,
    close: () => raw.close(),
  }
}

/**
 * Applies every migration that has not run yet. Idempotent, so the server can call it on each
 * boot: a fresh install creates its schema, an existing one is left untouched.
 */
export function migrateDb(db: Database, migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
}
