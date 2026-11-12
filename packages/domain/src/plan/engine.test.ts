import { describe, expect, it } from 'vitest'
import { DAY_TYPES, type DayType } from '../day-type'
import type { DayIndex } from '../rotation'
import { RULE_CODES } from '../rules/catalog'
import { ENFORCEMENT, blocksPublishing, validatePlan } from './engine'
import type {
  AssignmentRef,
  DayRef,
  GroupRef,
  PlanSnapshot,
  RosterRef,
  StandbyRef,
  VehicleRef,
} from './types'

const WEEK_START = '2026-09-21'

const days: DayRef[] = DAY_TYPES.map((dayType: DayType, index) => ({
  dayIndex: (index + 1) as DayIndex,
  dayType,
  date: `2026-09-${21 + index}`,
}))

const vehicles: VehicleRef[] = [
  { id: 'v1', plate: '003', lowFloor: true, airConditioned: true, status: 'active' },
  { id: 'v2', plate: '134', lowFloor: false, airConditioned: true, status: 'active' },
  { id: 'v3', plate: '229', lowFloor: true, airConditioned: true, status: 'maintenance' },
]

const routes = [
  { id: 'r1', code: '5', requiredLowFloor: false, requiredAc: false },
  { id: 'r2', code: '9AT', requiredLowFloor: true, requiredAc: false },
]

const groups: GroupRef[] = [
  { id: 'g1', code: 'TOKI', name: '(6) Toki', vehicleCount: 1, referenceDayIndex: 3 },
  { id: 'g2', code: 'KAMPUS', name: '(1) Kampüs/Konya', vehicleCount: 1, referenceDayIndex: 5 },
]

function assignment(overrides: Partial<AssignmentRef>): AssignmentRef {
  return {
    dayIndex: 5,
    vehicleId: 'v1',
    status: 'duty',
    groupId: 'g2',
    routeId: 'r1',
    extraDutyRouteId: null,
    firstTripMinute: null,
    locked: false,
    rawCode: '5',
    ...overrides,
  }
}

function roster(overrides: Partial<RosterRef> = {}): RosterRef {
  return {
    dayIndex: 5,
    driverId: 'd1',
    vehicleId: 'v1',
    startMinute: 6 * 60,
    endMinute: 14 * 60,
    drivingMinutes: 6 * 60,
    breakMinutes: 60,
    ...overrides,
  }
}

function plan(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    weekStart: WEEK_START,
    weekOffset: 0,
    days,
    vehicles,
    routes,
    groups,
    assignments: [assignment({})],
    standbys: [{ dayIndex: 3, vehicleId: 'v2', routeId: 'r1', rawCode: '5' }],
    roster: [roster()],
    ...overrides,
  }
}

const codes = (snapshot: PlanSnapshot) => validatePlan(snapshot).map((violation) => violation.code)

describe('validatePlan', () => {
  it('accepts a consistent plan', () => {
    expect(validatePlan(plan())).toEqual([])
  })

  it('R1: one assignment per vehicle per day', () => {
    const snapshot = plan({
      assignments: [assignment({}), assignment({ groupId: null, routeId: 'r2' })],
    })
    expect(codes(snapshot)).toContain('R1')
  })

  it('R3: a vehicle under maintenance cannot be assigned', () => {
    expect(codes(plan({ assignments: [assignment({ vehicleId: 'v3' })] }))).toContain('R3')
  })

  it('R4: an idle assignment must not carry duty data', () => {
    expect(codes(plan({ assignments: [assignment({ status: 'idle' })] }))).toContain('R4')
  })

  it('R7: the rotation law decides the weekday', () => {
    const violations = validatePlan(plan({ assignments: [assignment({ dayIndex: 2, groupId: 'g1' })] }))
    const r7 = violations.find((violation) => violation.code === 'R7')
    expect(r7?.message).toContain('ÇARŞAMBA')
    expect(r7?.message).toContain('SALI')
  })

  it('R9: two standby days and unresolved codes are rejected', () => {
    const standbys: StandbyRef[] = [
      { dayIndex: 2, vehicleId: 'v2', routeId: 'r1', rawCode: '5' },
      { dayIndex: 3, vehicleId: 'v2', routeId: 'r1', rawCode: '5' },
      { dayIndex: 4, vehicleId: 'v1', routeId: null, rawCode: 'ZZ' },
    ]
    const violations = validatePlan(plan({ standbys })).filter((violation) => violation.code === 'R9')
    expect(violations).toHaveLength(2)
  })

  it('R12: a route that needs a low-floor vehicle rejects a non-low-floor bus', () => {
    const snapshot = plan({
      assignments: [assignment({ dayIndex: 3, groupId: 'g1', routeId: 'r2', vehicleId: 'v2' })],
    })
    expect(codes(snapshot)).toContain('R12')
  })

  it('R13 and R14: group integrity', () => {
    const snapshot = plan({
      assignments: [
        assignment({}),
        assignment({ dayIndex: 3, groupId: 'g1', vehicleId: 'v2' }),
        assignment({ dayIndex: 4, groupId: 'g1', vehicleId: 'v3' }),
      ],
    })
    const violations = validatePlan(snapshot)
    expect(violations.some((violation) => violation.code === 'R14')).toBe(true)
    expect(violations.some((violation) => violation.code === 'R13')).toBe(true)
  })

  it('R15: the printed weekly total must match', () => {
    expect(codes(plan({ reportedWeeklyVehicleDays: 2 }))).toContain('R15')
    expect(codes(plan({ reportedWeeklyVehicleDays: 1 }))).not.toContain('R15')
  })

  it('R18: no duty the day after standby', () => {
    const snapshot = plan({
      standbys: [{ dayIndex: 4, vehicleId: 'v1', routeId: 'r1', rawCode: '5' }],
      assignments: [assignment({ dayIndex: 5 })],
    })
    expect(codes(snapshot)).toContain('R18')
  })

  it('R17: standby balance across the cycle', () => {
    const snapshot = plan({
      standbyHistory: [
        { vehicleId: 'v1', weekStart: '2026-09-07', dayIndex: 2 },
        { vehicleId: 'v1', weekStart: '2026-09-14', dayIndex: 4 },
        { vehicleId: 'v1', weekStart: '2026-08-31', dayIndex: 6 },
      ],
    })
    expect(codes(snapshot)).toContain('R17')
  })

  it('R5: daily counts against confirmed targets', () => {
    const snapshot = plan({
      countTargets: { weekday: { min: 2, max: 12 }, weekend: { min: 2, max: 24 } },
    })
    const r5 = validatePlan(snapshot).filter((violation) => violation.code === 'R5')
    expect(r5.length).toBeGreaterThan(0)
    expect(r5.every((violation) => violation.severity === 'soft')).toBe(true)
  })

  it('reports driver labour violations', () => {
    const snapshot = plan({
      roster: [
        roster({ drivingMinutes: 10 * 60, endMinute: 23 * 60 }),
        roster({ dayIndex: 6, startMinute: 5 * 60 }),
      ],
    })
    const violations = validatePlan(snapshot)
    expect(violations.map((v) => v.code)).toEqual(expect.arrayContaining(['L1', 'L4']))
  })

  it('blocks publishing only for hard rules', () => {
    const softOnly = plan({
      countTargets: { weekday: { min: 5, max: 12 }, weekend: { min: 18, max: 24 } },
    })
    expect(blocksPublishing(validatePlan(softOnly))).toBe(false)
    expect(blocksPublishing(validatePlan(plan({ assignments: [assignment({ vehicleId: 'v3' })] })))).toBe(true)
  })
})

describe('ENFORCEMENT', () => {
  it('accounts for every rule code', () => {
    for (const code of RULE_CODES) {
      expect(ENFORCEMENT[code]).toBeDefined()
    }
    expect(Object.keys(ENFORCEMENT)).toHaveLength(RULE_CODES.length)
  })
})
