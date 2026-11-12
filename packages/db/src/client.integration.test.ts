import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from './client'

/**
 * Integration check. Runs only when DATABASE_URL is present, so `pnpm test` stays
 * green on machines without a database (and in CI without one).
 */
const databaseUrl = process.env.DATABASE_URL

describe.skipIf(!databaseUrl)('database connection', () => {
  const handle = createDb(databaseUrl ?? '')
  afterAll(() => handle.close())

  it('answers a query', async () => {
    const rows = await handle.sql<{ ok: number }[]>`select 1 as ok`
    expect(rows[0]?.ok).toBe(1)
  })

  it('has the operational tables from the migration', async () => {
    const rows = await handle.sql<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `
    const names = rows.map((row) => row.table_name)
    expect(names).toEqual(expect.arrayContaining(['depot', 'organisation', 'vehicle']))
  })

  it('has PostGIS available for route geometry', async () => {
    const rows = await handle.sql<{ available: boolean }[]>`
      select exists(select 1 from pg_available_extensions where name = 'postgis') as available
    `
    expect(rows[0]?.available).toBe(true)
  })
})
