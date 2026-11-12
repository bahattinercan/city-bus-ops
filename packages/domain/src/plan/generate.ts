import { rotationDayIndex } from '../rotation'
import type { PlanSnapshot, Violation } from './types'
import type { AssignmentRef, DayRef, GroupRef, RouteRef, StandbyRef, VehicleRef } from './types'
import { validatePlan } from './engine'

export type GroupPlanRef = GroupRef & {
  /** Default route for the group's duties; null/absent when the operator has not assigned one. */
  readonly routeId?: string | null
}

export type GenerationInput = {
  readonly weekStart: string
  readonly weekOffset: number
  readonly days: readonly DayRef[]
  readonly vehicles: readonly VehicleRef[]
  readonly routes: readonly RouteRef[]
  readonly groups: readonly GroupPlanRef[]
  /** Hand-edited cells (R8): copied through untouched. */
  readonly lockedAssignments?: readonly AssignmentRef[]
  /** Standby generation is off unless the operator names the route code to print. */
  readonly standby?: { readonly perDay: number; readonly routeId: string } | undefined
}

export type GenerationResult = {
  readonly snapshot: PlanSnapshot
  readonly notices: readonly string[]
  readonly violations: readonly Violation[]
}

/**
 * Deterministic weekly plan generation.
 *
 * Not an optimiser: it applies the operator's rotation law and the vehicle-count
 * definitions, balances work across the fleet, and leaves optimisation for later. Same
 * input always produces the same plan, which is what makes a planner trust the button.
 */
export function generateWeeklyPlan(input: GenerationInput): GenerationResult {
  const notices: string[] = []
  const active = [...input.vehicles]
    .filter((vehicle) => vehicle.status === 'active')
    .sort((a, b) => a.plate.localeCompare(b.plate))

  const assignments: AssignmentRef[] = []
  const locked = new Map<string, AssignmentRef>()
  for (const assignment of input.lockedAssignments ?? []) {
    locked.set(`${assignment.dayIndex}:${assignment.vehicleId}`, assignment)
    assignments.push(assignment)
  }

  const vehicleDayTaken = new Set(assignments.map((a) => `${a.dayIndex}:${a.vehicleId}`))
  const loadByVehicle = new Map<string, number>()
  for (const assignment of assignments) {
    loadByVehicle.set(assignment.vehicleId, (loadByVehicle.get(assignment.vehicleId) ?? 0) + 1)
  }

  // 1) Duty groups, each on the weekday the rotation law dictates for this week.
  for (const group of input.groups) {
    const dayIndex = rotationDayIndex(group.referenceDayIndex, input.weekOffset)
    const candidates = active
      .filter((vehicle) => !vehicleDayTaken.has(`${dayIndex}:${vehicle.id}`))
      .sort((a, b) => {
        const loadDiff = (loadByVehicle.get(a.id) ?? 0) - (loadByVehicle.get(b.id) ?? 0)
        return loadDiff !== 0 ? loadDiff : a.plate.localeCompare(b.plate)
      })

    if (candidates.length < group.vehicleCount) {
      notices.push(
        `${group.name}: ${dayIndex}. gün için ${group.vehicleCount} araç gerekiyor, uygun araç ${candidates.length}.`,
      )
    }

    for (const vehicle of candidates.slice(0, group.vehicleCount)) {
      const key = `${dayIndex}:${vehicle.id}`
      if (locked.has(key)) continue
      vehicleDayTaken.add(key)
      loadByVehicle.set(vehicle.id, (loadByVehicle.get(vehicle.id) ?? 0) + 1)
      assignments.push({
        dayIndex,
        vehicleId: vehicle.id,
        status: 'duty',
        groupId: group.id,
        routeId: group.routeId ?? null,
        extraDutyRouteId: null,
        firstTripMinute: null,
        locked: false,
        rawCode: group.routeId === null ? group.code : null,
      })
    }
  }

  // 2) Standby, only when a route code is configured.
  const standbys: StandbyRef[] = []
  if (input.standby !== undefined && input.standby.perDay > 0) {
    for (const day of input.days) {
      const free = active
        .filter((vehicle) => !vehicleDayTaken.has(`${day.dayIndex}:${vehicle.id}`))
        .sort((a, b) => {
          const loadDiff = (loadByVehicle.get(a.id) ?? 0) - (loadByVehicle.get(b.id) ?? 0)
          return loadDiff !== 0 ? loadDiff : a.plate.localeCompare(b.plate)
        })
        .slice(0, input.standby.perDay)

      for (const vehicle of free) {
        standbys.push({
          dayIndex: day.dayIndex,
          vehicleId: vehicle.id,
          routeId: input.standby?.routeId ?? null,
          rawCode: 'x',
        })
        vehicleDayTaken.add(`${day.dayIndex}:${vehicle.id}`)
        loadByVehicle.set(vehicle.id, (loadByVehicle.get(vehicle.id) ?? 0) + 1)
      }
    }
  }

  // 3) Everything else that is active and unassigned is idle (YAT on the printed sheet).
  for (const day of input.days) {
    for (const vehicle of active) {
      const key = `${day.dayIndex}:${vehicle.id}`
      if (vehicleDayTaken.has(key)) continue
      vehicleDayTaken.add(key)
      assignments.push({
        dayIndex: day.dayIndex,
        vehicleId: vehicle.id,
        status: 'idle',
        groupId: null,
        routeId: null,
        extraDutyRouteId: null,
        firstTripMinute: null,
        locked: false,
        rawCode: null,
      })
    }
  }

  const snapshot: PlanSnapshot = {
    weekStart: input.weekStart,
    weekOffset: input.weekOffset,
    days: input.days,
    vehicles: input.vehicles,
    routes: input.routes,
    groups: input.groups,
    assignments: assignments.sort(
      (a, b) => a.dayIndex - b.dayIndex || a.vehicleId.localeCompare(b.vehicleId),
    ),
    standbys,
    roster: [],
  }

  return { snapshot, notices, violations: validatePlan(snapshot) }
}

/** Printed cell text: group/route code for a duty, `x` for standby, `YAT` for idle. */
export function cellLabel(
  assignment: AssignmentRef,
  groups: ReadonlyMap<string, GroupRef>,
  routes: ReadonlyMap<string, RouteRef>,
): string {
  if (assignment.status === 'standby') return 'x'
  if (assignment.status === 'idle') return 'YAT'
  if (assignment.status === 'unavailable') return 'İZİN'
  const route = assignment.routeId === null ? undefined : routes.get(assignment.routeId)
  if (route !== undefined) return route.code
  const group = assignment.groupId === null ? undefined : groups.get(assignment.groupId)
  return group?.code ?? assignment.rawCode ?? '—'
}
