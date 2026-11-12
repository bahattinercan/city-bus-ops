import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import { depots, organisations, vehicles } from './schema'

describe('schema', () => {
  it('uses stable singular table names', () => {
    expect(getTableName(organisations)).toBe('organisation')
    expect(getTableName(depots)).toBe('depot')
    expect(getTableName(vehicles)).toBe('vehicle')
  })

  it('keeps the plate number unique per organisation', () => {
    const plateColumn = vehicles.plateNumber
    expect(plateColumn.name).toBe('plate_number')
    expect(plateColumn.notNull).toBe(true)
  })

  it('requires an organisation on every operational row', () => {
    expect(depots.organisationId.notNull).toBe(true)
    expect(vehicles.organisationId.notNull).toBe(true)
  })
})
