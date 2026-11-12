import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = ReturnType<typeof createDb>['db']

/**
 * Opens a connection pool. Callers own the lifecycle: `await handle.close()` on shutdown.
 * The URL is validated here so a missing DATABASE_URL fails at startup, not mid-request.
 */
export function createDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = postgres(databaseUrl, { max: 10 })
  const db = drizzle(sql, { schema })

  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  }
}
