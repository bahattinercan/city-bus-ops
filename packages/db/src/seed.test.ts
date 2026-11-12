import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from './client'
import { SEED_SUMMARY, seedReferenceData } from './seed'
import { dutyGroups, routes, vehicles } from './schema'

/**
 * Integration seed check. Requires DATABASE_URL (see docs); skips otherwise so
 * `pnpm test` stays green without a database.
 */
const databaseUrl = process.env.DATABASE_URL
const handle = databaseUrl ? createDb(databaseUrl) : undefined

afterAll(async () => {
  await handle?.close()
})

describe.skipIf(!databaseUrl)('reference data seed', () => {
  it('is idempotent and seeds the documented fleet', async () => {
    if (handle === undefined) throw new Error('unreachable')

    const first = await seedReferenceData(handle)
    const second = await seedReferenceData(handle)
    expect(second.organisationId).toBe(first.organisationId)

    const vehicleRows = await handle.sql<{ count: string; handwritten: string }[]>`
      select count(*)::text as count,
             count(*) filter (where source = 'handwritten')::text as handwritten
      from vehicle
      where organisation_id = ${first.organisationId}
    `
    expect(vehicleRows[0]?.count).toBe(String(SEED_SUMMARY.vehicleCount))
    expect(vehicleRows[0]?.handwritten).toBe('4')

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
