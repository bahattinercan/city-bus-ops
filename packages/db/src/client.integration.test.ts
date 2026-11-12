import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from './client'

/**
 * Integration check. Runs only when DATABASE_URL is present, so `pnpm test` stays
 * green on machines without a database and the skip path never opens a connection.
 */
const databaseUrl = process.env.DATABASE_URL
const handle = databaseUrl ? createDb(databaseUrl) : undefined

function connection() {
  if (handle === undefined) {
    throw new Error('DATABASE_URL is missing — integration test should have been skipped')
  }
  return handle
}

// Registered at file scope so the pool is closed whether the suite ran or was skipped.
afterAll(async () => {
  await handle?.close()
})

describe.skipIf(!databaseUrl)('database connection', () => {
  it('answers a query', async () => {
    const rows = await connection().sql<{ ok: number }[]>`select 1 as ok`
    expect(rows[0]?.ok).toBe(1)
  })

  it('has the operational tables from the migration', async () => {
    const rows = await connection().sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `
    const names = rows.map((row) => row.table_name)
    expect(names).toEqual(expect.arrayContaining(['depot', 'organisation', 'vehicle']))
  })

  it('has PostGIS available for route geometry', async () => {
    const rows = await connection().sql<{ available: boolean }[]>`
      select exists(select 1 from pg_available_extensions where name = 'postgis') as available
    `
    expect(rows[0]?.available).toBe(true)
  })
})
