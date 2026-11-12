import type { DayType } from '../day-type'
import type { DayIndex } from '../rotation'
import type { RuleSeverity } from '../rules/catalog'

export type VehicleStatus = 'active' | 'maintenance' | 'retired'
export type AssignmentStatus = 'duty' | 'standby' | 'idle' | 'unavailable'
export type PlanStatus = 'draft' | 'published' | 'archived'

export type VehicleRef = {
  readonly id: string
  readonly plate: string
  readonly lowFloor: boolean
  readonly airConditioned: boolean
  readonly status: VehicleStatus
}

export type RouteRef = {
  readonly id: string
  readonly code: string
  readonly requiredLowFloor: boolean
  readonly requiredAc: boolean
}

/** A duty group's weekday moves through the week; `referenceDayIndex` is its anchor weekday. */
export type GroupRef = {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly vehicleCount: number
  readonly referenceDayIndex: DayIndex
}

export type DayRef = {
  readonly dayIndex: DayIndex
  readonly dayType: DayType
  /** `YYYY-MM-DD`. */
  readonly date: string
}

export type AssignmentRef = {
  readonly dayIndex: DayIndex
  readonly vehicleId: string
  readonly status: AssignmentStatus
  readonly groupId: string | null
  readonly routeId: string | null
  readonly extraDutyRouteId: string | null
  /** First departure of the vehicle that day, minutes after midnight (legacy S15). */
  readonly firstTripMinute: number | null
  readonly locked: boolean
  readonly rawCode: string | null
}

export type StandbyRef = {
  readonly dayIndex: DayIndex
  readonly vehicleId: string
  readonly routeId: string | null
  /** The route code as printed in the NÖBET column; must resolve to `routeId`. */
  readonly rawCode: string
}

export type StandbyHistoryRef = {
  readonly vehicleId: string
  /** Monday of the week, `YYYY-MM-DD`. */
  readonly weekStart: string
  readonly dayIndex: DayIndex
}

export type RosterRef = {
  readonly dayIndex: DayIndex
  readonly driverId: string
  readonly vehicleId: string
  readonly startMinute: number
  readonly endMinute: number
  readonly drivingMinutes: number
  readonly breakMinutes: number
}

export type AbsenceRef = {
  readonly subject: 'driver' | 'vehicle'
  readonly subjectId: string
  /** Inclusive date range, `YYYY-MM-DD`. */
  readonly dateFrom: string
  readonly dateTo: string
}

export type TripAssignmentRef = {
  readonly tripId: string
  readonly vehicleId: string
  readonly dayIndex: DayIndex
  readonly routeId: string
  readonly dayType: DayType
}

/** R5/R6 targets. Left `undefined` when the operator has not confirmed a range. */
export type CountTargets = {
  readonly weekday: { readonly min: number; readonly max: number }
  readonly weekend: { readonly min: number; readonly max: number }
}

export type PlanSnapshot = {
  /** Monday of the planned week, `YYYY-MM-DD`. */
  readonly weekStart: string
  /** Whole weeks since the rotation anchor week (legacy `w`). */
  readonly weekOffset: number
  readonly days: readonly DayRef[]
  readonly vehicles: readonly VehicleRef[]
  readonly routes: readonly RouteRef[]
  readonly groups: readonly GroupRef[]
  readonly assignments: readonly AssignmentRef[]
  readonly standbys: readonly StandbyRef[]
  readonly roster: readonly RosterRef[]
  readonly tripAssignments?: readonly TripAssignmentRef[]
  /** Vehicle blocking output: which trips each vehicle runs that day. */
  readonly tripBlocks?: readonly {
    readonly dayIndex: DayIndex
    readonly vehicleId: string
    readonly tripIds: readonly string[]
  }[]
  readonly absences?: readonly AbsenceRef[]
  readonly standbyHistory?: readonly StandbyHistoryRef[]
  /** Weekly total printed on the sheet (legacy `=76`), when known. */
  readonly reportedWeeklyVehicleDays?: number
  readonly countTargets?: CountTargets
}

export type Violation = {
  readonly code: string
  readonly severity: RuleSeverity
  readonly message: string
  readonly dayIndex?: DayIndex
  readonly vehicleId?: string
  readonly driverId?: string
  readonly groupId?: string
}
