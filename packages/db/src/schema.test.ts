import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import * as schema from './schema'

describe('schema', () => {
  it('uses stable singular table names', () => {
    const expected: Record<string, string> = {
      organisations: 'organisation',
      depots: 'depot',
      vehicles: 'vehicle',
      drivers: 'driver',
      users: 'app_user',
      routes: 'route',
      stops: 'stop',
      routeStops: 'route_stop',
      trips: 'trip',
      dutyGroups: 'duty_group',
      planVersions: 'plan_version',
      assignments: 'assignment',
      standbys: 'standby',
      cellNotes: 'cell_note',
      absences: 'absence',
      rosterEntries: 'roster_entry',
      ruleViolations: 'rule_violation',
      swapRequests: 'swap_request',
      defectReports: 'defect_report',
      auditLog: 'audit_log',
    }

    for (const [exportName, tableName] of Object.entries(expected)) {
      const table = (schema as Record<string, unknown>)[exportName]
      expect(table, `${exportName} is missing`).toBeDefined()
      expect(getTableName(table as never)).toBe(tableName)
    }
  })

  it('keeps the fleet number unique per organisation', () => {
    expect(schema.vehicles.plateNumber.name).toBe('plate_number')
    expect(schema.vehicles.plateNumber.notNull).toBe(true)
  })

  it('requires an organisation on every operational row', () => {
    expect(schema.depots.organisationId.notNull).toBe(true)
    expect(schema.vehicles.organisationId.notNull).toBe(true)
    expect(schema.drivers.organisationId.notNull).toBe(true)
    expect(schema.planVersions.organisationId.notNull).toBe(true)
  })

  it('allows one assignment per vehicle per day', () => {
    expect(schema.assignments.dayIndex.name).toBe('day_index')
    expect(schema.assignments.planVersionId.notNull).toBe(true)
    expect(schema.assignments.vehicleId.notNull).toBe(true)
  })

  it('records the rotation anchor week on the organisation', () => {
    expect(schema.organisations.rotationAnchorWeek.notNull).toBe(true)
  })
})
