import { LABOUR_LIMITS, type DayRef, type PlanSnapshot, type RosterRef } from '@citybus/domain'

export type RosterDriver = {
  readonly id: string
  readonly fullName: string
  readonly active: boolean
}

export type TripWindow = {
  readonly startMinute: number
  readonly endMinute: number
}

export type DriverAbsence = {
  readonly driverId: string
  readonly dateFrom: string
  readonly dateTo: string
}

export type RosterPlan = {
  readonly entries: readonly RosterRef[]
  readonly notices: readonly string[]
}

/**
 * Run cutting, simplified: one driver per vehicle duty.
 *
 * The duty window comes from the route's real trips on that day type (first departure to
 * last arrival) plus sign-on and sign-off allowance. Break time is the unpaid gap inside
 * the window — good enough to run the labour rules, and replaceable by a proper run cutter
 * once the operator confirms the break rules.
 */
export function buildRoster(input: {
  readonly snapshot: PlanSnapshot
  readonly drivers: readonly RosterDriver[]
  /** Fallback when a vehicle has no block (no timetable for that route/day). */
  readonly tripsByRouteDay: ReadonlyMap<string, readonly TripWindow[]>
  /** Trips keyed by id, used to size a vehicle's own block. */
  readonly tripsById?: ReadonlyMap<string, TripWindow>
  readonly absences: readonly DriverAbsence[]
}): RosterPlan {
  const notices: string[] = []
  const entries: RosterRef[] = []
  const activeDrivers = input.drivers.filter((driver) => driver.active)
  const load = new Map<string, number>()
  const usedPerDay = new Map<string, Set<string>>(new Map())
  const dayByIndex = new Map(input.snapshot.days.map((day) => [day.dayIndex, day]))

  const dutyAssignments = input.snapshot.assignments
    .filter((assignment) => assignment.status === 'duty')
    .sort((a, b) => a.dayIndex - b.dayIndex || a.vehicleId.localeCompare(b.vehicleId))

  for (const assignment of dutyAssignments) {
    const day = dayByIndex.get(assignment.dayIndex)
    if (day === undefined) continue

    const block = input.snapshot.tripBlocks?.find(
      (candidate) => candidate.dayIndex === assignment.dayIndex && candidate.vehicleId === assignment.vehicleId,
    )
    const blockTrips =
      block === undefined || input.tripsById === undefined
        ? []
        : block.tripIds.flatMap((tripId) => {
            const trip = input.tripsById?.get(tripId)
            return trip === undefined ? [] : [trip]
          })
    const blocksExist = (input.snapshot.tripBlocks?.length ?? 0) > 0
    // With blocking in place, a vehicle without a block genuinely has no trip today (spare
    // capacity). Falling back to the whole route would invent a 17-hour duty.
    const trips =
      blockTrips.length > 0
        ? blockTrips
        : blocksExist
          ? []
          : tripsOf(input.tripsByRouteDay, assignment.routeId, day)

    if (trips.length === 0) {
      notices.push(
        `${plateLabel(input.snapshot, assignment.vehicleId)} için ${day.date} günü sefer bulunamadı, şoför atanmadı.`,
      )
      continue
    }

    const firstStart = Math.min(...trips.map((trip) => trip.startMinute))
    const lastEnd = Math.max(...trips.map((trip) => trip.endMinute))
    const startMinute = Math.max(0, firstStart - LABOUR_LIMITS.preparationMinutes)
    const endMinute = lastEnd + LABOUR_LIMITS.cleaningMinutes
    const drivingMinutes = trips.reduce((sum, trip) => sum + (trip.endMinute - trip.startMinute), 0)
    const breakMinutes = Math.max(0, endMinute - startMinute - drivingMinutes)

    const dayKey = String(day.dayIndex)
    const used = usedPerDay.get(dayKey) ?? new Set<string>()
    usedPerDay.set(dayKey, used)

    const candidate = activeDrivers
      .filter((driver) => !used.has(driver.id))
      .filter((driver) => !isAbsent(input.absences, driver.id, day.date))
      .sort((a, b) => {
        const loadDiff = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
        return loadDiff !== 0 ? loadDiff : a.fullName.localeCompare(b.fullName)
      })[0]

    if (candidate === undefined) {
      notices.push(`${day.date}: ${plateLabel(input.snapshot, assignment.vehicleId)} için uygun şoför yok.`)
      continue
    }

    used.add(candidate.id)
    load.set(candidate.id, (load.get(candidate.id) ?? 0) + 1)
    entries.push({
      dayIndex: assignment.dayIndex,
      driverId: candidate.id,
      vehicleId: assignment.vehicleId,
      startMinute,
      endMinute,
      drivingMinutes,
      breakMinutes,
    })
  }

  return { entries, notices }
}

function tripsOf(
  tripsByRouteDay: ReadonlyMap<string, readonly TripWindow[]>,
  routeId: string | null,
  day: DayRef,
): readonly TripWindow[] {
  if (routeId === null) return []
  return tripsByRouteDay.get(`${routeId}:${day.dayType}`) ?? []
}

function isAbsent(absences: readonly DriverAbsence[], driverId: string, date: string): boolean {
  return absences.some(
    (absence) => absence.driverId === driverId && date >= absence.dateFrom && date <= absence.dateTo,
  )
}

function plateLabel(snapshot: PlanSnapshot, vehicleId: string): string {
  return snapshot.vehicles.find((vehicle) => vehicle.id === vehicleId)?.plate ?? vehicleId
}
