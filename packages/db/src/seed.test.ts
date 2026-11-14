import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb, migrateDb } from './client'
import { SEED_SUMMARY, seedReferenceData } from './seed'
import { dutyGroups, routes, vehicles } from './schema'

/** Seeds a real SQLite file: the desktop dialect, so this always runs. */
const directory = mkdtempSync(join(tmpdir(), 'citybus-seed-'))
const handle = createDb(join(directory, 'seed.db'))
migrateDb(handle.db, join(import.meta.dirname, '..', 'drizzle-sqlite'))

afterAll(() => {
  handle.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('reference data seed', () => {
  it('is idempotent and seeds the documented fleet', async () => {
    const first = await seedReferenceData(handle)
    const second = await seedReferenceData(handle)
    expect(second.organisationId).toBe(first.organisationId)

    const [counts] = handle.db.all<{ count: number; handwritten: number }>(sql`
      select count(*) as count,
             count(*) filter (where source = 'handwritten') as handwritten
      from vehicle
      where organisation_id = ${first.organisationId}
    `)
    expect(counts?.count).toBe(SEED_SUMMARY.vehicleCount)
    expect(counts?.handwritten).toBe(4)

    const routeRows = await handle.db.select().from(routes)
    expect(routeRows).toHaveLength(SEED_SUMMARY.routeCount)

    const groupRows = await handle.db.select().from(dutyGroups)
    expect(groupRows).toHaveLength(SEED_SUMMARY.dutyGroupCount)
    expect(groupRows.find((group) => group.code === 'TOKI')?.referenceDayIndex).toBe(3)

    const plateRows = await handle.db.select().from(vehicles)
    const plates = plateRows.map((row) => row.plateNumber).sort()
    expect(plates).toContain('003')
    expect(plates).toHaveLength(SEED_SUMMARY.vehicleCount)
  })
})
