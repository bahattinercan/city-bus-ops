import { describe, expect, it } from 'vitest'
import { DAY_TYPES } from '../day-type'
import type { DayIndex } from '../rotation'
import { cellLabel, generateWeeklyPlan, type GroupPlanRef } from './generate'
import type { DayRef, RouteRef, VehicleRef } from './types'

const days: DayRef[] = DAY_TYPES.map((dayType, index) => ({
  dayIndex: (index + 1) as DayIndex,
  dayType,
  date: `2026-09-${21 + index}`,
}))

const vehicles: VehicleRef[] = Array.from({ length: 12 }, (_, index) => ({
  id: `v${index + 1}`,
  plate: String(index + 1).padStart(3, '0'),
  lowFloor: true,
  airConditioned: true,
  status: 'active',
}))

const routes: RouteRef[] = [{ id: 'r1', code: '9A', requiredLowFloor: false, requiredAc: false }]

const groups: GroupPlanRef[] = [
  { id: 'g1', code: 'TOKI', name: '(6) Toki', vehicleCount: 6, referenceDayIndex: 3, routeId: 'r1' },
  { id: 'g2', code: 'CUKUR', name: '(5) B.Çukur', vehicleCount: 5, referenceDayIndex: 1, routeId: 'r1' },
]

function generate(overrides: Partial<Parameters<typeof generateWeeklyPlan>[0]> = {}) {
  return generateWeeklyPlan({
    weekStart: '2026-09-21',
    weekOffset: 0,
    days,
    vehicles,
    routes,
    groups,
    ...overrides,
  })
}

describe('generateWeeklyPlan', () => {
  it('puts each group on the weekday the rotation law requires', () => {
    const result = generate()
    const toki = result.snapshot.assignments.filter(
      (a) => a.groupId === 'g1' && a.status === 'duty',
    )
    // g0=3 with w=0 -> Wednesday (dayIndex 3)
    expect(new Set(toki.map((a) => a.dayIndex))).toEqual(new Set([3]))
    expect(toki).toHaveLength(6)
  })

  it('has no hard violations for a consistent input', () => {
    const result = generate()
    expect(result.violations.filter((v) => v.severity === 'hard')).toEqual([])
  })

  it('gives every active vehicle exactly one cell per day', () => {
    const result = generate()
    for (const day of days) {
      const cells = result.snapshot.assignments.filter((a) => a.dayIndex === day.dayIndex)
      expect(cells).toHaveLength(vehicles.length)
      expect(new Set(cells.map((a) => a.vehicleId)).size).toBe(vehicles.length)
    }
  })

  it('marks unassigned vehicles idle and counts them as YAT', () => {
    const result = generate()
    const day1 = result.snapshot.assignments.filter((a) => a.dayIndex === 1)
    const idle = day1.filter((a) => a.status === 'idle')
    expect(idle).toHaveLength(vehicles.length - 5)

    const groupsById = new Map(groups.map((group) => [group.id, group]))
    const routesById = new Map(routes.map((route) => [route.id, route]))
    const cell = idle[0]
    expect(cell === undefined ? '' : cellLabel(cell, groupsById, routesById)).toBe('YAT')
  })

  it('balances work so nobody carries the whole week', () => {
    const result = generate()
    const dutyCounts = new Map<string, number>()
    for (const assignment of result.snapshot.assignments) {
      if (assignment.status !== 'duty') continue
      dutyCounts.set(assignment.vehicleId, (dutyCounts.get(assignment.vehicleId) ?? 0) + 1)
    }
    const counts = [...dutyCounts.values()]
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('generates standby only when a route code is configured', () => {
    expect(generate().snapshot.standbys).toHaveLength(0)

    const withStandby = generate({ standby: { perDay: 1, routeId: 'r1' } })
    expect(withStandby.snapshot.standbys).toHaveLength(7)
    expect(withStandby.violations.filter((v) => v.code === 'R9')).toEqual([])
  })

  it('keeps locked hand edits untouched', () => {
    const result = generate({
      lockedAssignments: [
        {
          dayIndex: 3,
          vehicleId: 'v1',
          status: 'duty',
          groupId: 'g1',
          routeId: 'r1',
          extraDutyRouteId: null,
          firstTripMinute: 12 * 60,
          locked: true,
          rawCode: '9A',
        },
      ],
    })
    const cell = result.snapshot.assignments.find(
      (a) => a.dayIndex === 3 && a.vehicleId === 'v1',
    )
    expect(cell?.locked).toBe(true)
    expect(cell?.firstTripMinute).toBe(720)
  })

  it('is deterministic', () => {
    expect(generate().snapshot).toEqual(generate().snapshot)
  })

  it('reports when the fleet cannot fill a group', () => {
    const result = generate({
      vehicles: vehicles.slice(0, 3),
      groups: [groups[0] as GroupPlanRef],
    })
    expect(result.notices.join(' ')).toContain('6 araç gerekiyor')
  })

  it('labels cells the way the printed sheet does', () => {
    const groupsById = new Map(groups.map((group) => [group.id, group]))
    const routesById = new Map(routes.map((route) => [route.id, route]))
    const result = generate({ standby: { perDay: 1, routeId: 'r1' } })

    const duty = result.snapshot.assignments.find((a) => a.status === 'duty' && a.dayIndex === 3)
    expect(duty === undefined ? '' : cellLabel(duty, groupsById, routesById)).toBe('9A')

    const standby = result.snapshot.standbys[0]
    expect(standby?.rawCode).toBe('x')
  })
})
