import { printLabel } from '../day-type'
import { LABOUR_LIMITS, evaluateDutySpan, evaluateRest } from '../labour'
import { DRIVER_RULE_CATALOG, RULE_CATALOG, type RuleCode } from '../rules/catalog'
import { ROTATION_DAYS, rotationDayIndex } from '../rotation'
import type { PlanSnapshot, Violation } from './types'

/**
 * Where each rule is enforced. The mapping is asserted by tests, so a rule can never be
 * silently dropped: either the engine checks it, the write path guards it, or the entry
 * says why it is deferred.
 */
export const ENFORCEMENT: Readonly<Record<RuleCode, 'engine' | 'write-guard'>> = {
  R1: 'engine',
  R2: 'engine',
  R3: 'engine',
  R4: 'engine',
  R5: 'engine',
  R6: 'engine',
  R7: 'engine',
  R8: 'write-guard',
  R9: 'engine',
  R10: 'engine',
  R11: 'write-guard',
  R12: 'engine',
  R13: 'engine',
  R14: 'engine',
  R15: 'engine',
  R16: 'engine',
  R17: 'engine',
  R18: 'engine',
}

/**
 * Validates a plan snapshot. Pure: no I/O, deterministic output order
 * (rule code, then day, then vehicle) so UI diffs and tests are stable.
 */
export function validatePlan(snapshot: PlanSnapshot): Violation[] {
  const violations: Violation[] = []
  const dayByIndex = new Map(snapshot.days.map((day) => [day.dayIndex, day]))
  const vehicleById = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const routeById = new Map(snapshot.routes.map((route) => [route.id, route]))
  const groupById = new Map(snapshot.groups.map((group) => [group.id, group]))

  // R1 — one assignment per vehicle per day.
  const seenVehicleDay = new Map<string, number>()
  for (const assignment of snapshot.assignments) {
    const key = `${assignment.dayIndex}:${assignment.vehicleId}`
    const count = (seenVehicleDay.get(key) ?? 0) + 1
    seenVehicleDay.set(key, count)
    if (count > 1) {
      violations.push({
        code: 'R1',
        severity: RULE_CATALOG.R1.severity,
        dayIndex: assignment.dayIndex,
        vehicleId: assignment.vehicleId,
        message: `Araç ${plateOf(vehicleById, assignment.vehicleId)} ${dateOf(dayByIndex, assignment.dayIndex)} gününde birden fazla göreve atanmış.`,
      })
    }
  }

  // R2 / R12 / R16 — trip-level checks (only when trip assignments are provided).
  const seenTripDay = new Map<string, string>()
  for (const trip of snapshot.tripAssignments ?? []) {
    const tripKey = `${trip.dayIndex}:${trip.tripId}`
    const firstVehicle = seenTripDay.get(tripKey)
    if (firstVehicle !== undefined && firstVehicle !== trip.vehicleId) {
      violations.push({
        code: 'R2',
        severity: RULE_CATALOG.R2.severity,
        dayIndex: trip.dayIndex,
        vehicleId: trip.vehicleId,
        message: `Sefer ${trip.tripId} hem ${plateOf(vehicleById, firstVehicle)} hem ${plateOf(vehicleById, trip.vehicleId)} üzerinde görünüyor.`,
      })
    }
    seenTripDay.set(tripKey, trip.vehicleId)

    const day = dayByIndex.get(trip.dayIndex)
    if (day !== undefined && day.dayType !== trip.dayType) {
      violations.push({
        code: 'R16',
        severity: RULE_CATALOG.R16.severity,
        dayIndex: trip.dayIndex,
        vehicleId: trip.vehicleId,
        message: `Sefer ${trip.tripId} ${trip.dayType} tarifesinde tanımlı, gün ${day.dayType}.`,
      })
    }

    const route = routeById.get(trip.routeId)
    const vehicle = vehicleById.get(trip.vehicleId)
    if (route !== undefined && vehicle !== undefined) {
      if (route.requiredLowFloor && !vehicle.lowFloor) {
        violations.push({
          code: 'R12',
          severity: RULE_CATALOG.R12.severity,
          dayIndex: trip.dayIndex,
          vehicleId: vehicle.id,
          message: `${vehicle.plate} ${route.code} hattı için engelli erişimi gerektiriyor ancak araçta yok.`,
        })
      }
      if (route.requiredAc && !vehicle.airConditioned) {
        violations.push({
          code: 'R12',
          severity: RULE_CATALOG.R12.severity,
          dayIndex: trip.dayIndex,
          vehicleId: vehicle.id,
          message: `${vehicle.plate} ${route.code} hattı için klima gerekiyor ancak araçta yok.`,
        })
      }
    }
  }

  // R3 / R4 / R7 / R12 — per assignment.
  for (const assignment of snapshot.assignments) {
    const vehicle = vehicleById.get(assignment.vehicleId)
    const date = dateOf(dayByIndex, assignment.dayIndex)
    const plate = plateOf(vehicleById, assignment.vehicleId)

    if (vehicle !== undefined && vehicle.status !== 'active') {
      violations.push({
        code: 'R3',
        severity: RULE_CATALOG.R3.severity,
        dayIndex: assignment.dayIndex,
        vehicleId: vehicle.id,
        message: `${plate} ${date} günü ${statusLabel(vehicle.status)} durumunda, görev alamaz.`,
      })
    }

    for (const absence of snapshot.absences ?? []) {
      if (absence.subject !== 'vehicle' || absence.subjectId !== assignment.vehicleId) continue
      if (date !== undefined && date >= absence.dateFrom && date <= absence.dateTo) {
        violations.push({
          code: 'R3',
          severity: RULE_CATALOG.R3.severity,
          dayIndex: assignment.dayIndex,
          vehicleId: assignment.vehicleId,
          message: `${plate} ${date} günü izinli/bakımda, görev alamaz.`,
        })
      }
    }

    if (
      assignment.status === 'idle' &&
      (assignment.routeId !== null ||
        assignment.extraDutyRouteId !== null ||
        assignment.firstTripMinute !== null)
    ) {
      violations.push({
        code: 'R4',
        severity: RULE_CATALOG.R4.severity,
        dayIndex: assignment.dayIndex,
        vehicleId: assignment.vehicleId,
        message: `${plate} yatan araç olarak işaretli ama görev bilgisi taşıyor.`,
      })
    }

    if (assignment.groupId !== null && assignment.status === 'duty') {
      const group = groupById.get(assignment.groupId)
      if (group !== undefined) {
        const expected = rotationDayIndex(group.referenceDayIndex, snapshot.weekOffset)
        if (expected !== assignment.dayIndex) {
          violations.push({
            code: 'R7',
            severity: RULE_CATALOG.R7.severity,
            dayIndex: assignment.dayIndex,
            vehicleId: assignment.vehicleId,
            groupId: group.id,
            message: `${group.name} bu hafta ${dayLabel(expected)} gününde olmalıydı, ${dayLabel(assignment.dayIndex)} gününe atanmış.`,
          })
        }
      }
    }

    const routeId = assignment.routeId ?? assignment.extraDutyRouteId
    const route = routeId === null ? undefined : routeById.get(routeId)
    if (route !== undefined && vehicle !== undefined) {
      if (route.requiredLowFloor && !vehicle.lowFloor) {
        violations.push({
          code: 'R12',
          severity: RULE_CATALOG.R12.severity,
          dayIndex: assignment.dayIndex,
          vehicleId: vehicle.id,
          message: `${plate} ${route.code} hattı için gerekli engelli erişimine sahip değil.`,
        })
      }
      if (route.requiredAc && !vehicle.airConditioned) {
        violations.push({
          code: 'R12',
          severity: RULE_CATALOG.R12.severity,
          dayIndex: assignment.dayIndex,
          vehicleId: vehicle.id,
          message: `${plate} ${route.code} hattı için gerekli klimaya sahip değil.`,
        })
      }
    }
  }

  // R9 — at most one standby day per vehicle per week, and the standby code must resolve.
  const standbyCount = new Map<string, number>()
  for (const standby of snapshot.standbys) {
    standbyCount.set(standby.vehicleId, (standbyCount.get(standby.vehicleId) ?? 0) + 1)

    if (standby.routeId === null) {
      violations.push({
        code: 'R9',
        severity: RULE_CATALOG.R9.severity,
        dayIndex: standby.dayIndex,
        vehicleId: standby.vehicleId,
        message: `${plateOf(vehicleById, standby.vehicleId)} nöbet kodu "${standby.rawCode}" hat sözlüğünde bulunamadı.`,
      })
    }
  }
  for (const [vehicleId, count] of standbyCount) {
    if (count > 1) {
      violations.push({
        code: 'R9',
        severity: RULE_CATALOG.R9.severity,
        vehicleId,
        message: `${plateOf(vehicleById, vehicleId)} bu hafta ${count} nöbet günü almış, en fazla 1 olmalı.`,
      })
    }
  }

  // R13 / R14 — duty group integrity.
  const groupDays = new Map<string, Set<number>>()
  const groupCounts = new Map<string, number>()
  for (const assignment of snapshot.assignments) {
    if (assignment.groupId === null || assignment.status !== 'duty') continue
    const days = groupDays.get(assignment.groupId) ?? new Set<number>()
    days.add(assignment.dayIndex)
    groupDays.set(assignment.groupId, days)
    groupCounts.set(assignment.groupId, (groupCounts.get(assignment.groupId) ?? 0) + 1)
  }
  for (const [groupId, days] of groupDays) {
    const group = groupById.get(groupId)
    if (group === undefined) continue

    if (days.size > 1) {
      const labels = [...days].sort().map(dayLabel).join(' ve ')
      violations.push({
        code: 'R14',
        severity: RULE_CATALOG.R14.severity,
        groupId,
        message: `${group.name} bu hafta hem ${labels} günlerine atanmış.`,
      })
    }

    const count = groupCounts.get(groupId) ?? 0
    if (count !== group.vehicleCount) {
      violations.push({
        code: 'R13',
        severity: RULE_CATALOG.R13.severity,
        groupId,
        message: `${group.name} grubunda ${count} araç var, tanımlı sayı ${group.vehicleCount}.`,
      })
    }
  }

  // R5 / R6 — daily counts (only when the operator confirmed target ranges).
  if (snapshot.countTargets !== undefined) {
    const counts = new Map<number, number>()
    for (const assignment of snapshot.assignments) {
      if (assignment.status !== 'duty') continue
      counts.set(assignment.dayIndex, (counts.get(assignment.dayIndex) ?? 0) + 1)
    }

    const weekdayCounts: number[] = []
    const weekendCounts: number[] = []
    for (const day of snapshot.days) {
      const count = counts.get(day.dayIndex) ?? 0
      const isWeekend = day.dayType === 'saturday' || day.dayType === 'sunday'
      const target = isWeekend ? snapshot.countTargets.weekend : snapshot.countTargets.weekday
      if (isWeekend) weekendCounts.push(count)
      else weekdayCounts.push(count)

      if (count < target.min || count > target.max) {
        violations.push({
          code: 'R5',
          severity: RULE_CATALOG.R5.severity,
          dayIndex: day.dayIndex,
          message: `${day.date}: ${count} araç çalışıyor, beklenen ${target.min}–${target.max}.`,
        })
      }
    }

    const weekdayAverage = weekdayCounts.length === 0 ? 0 : average(weekdayCounts)
    const saturday = counts.get(6) ?? 0
    const sunday = counts.get(7) ?? 0
    if (weekendCounts.length > 0 && (saturday < weekdayAverage || sunday < weekdayAverage)) {
      violations.push({
        code: 'R6',
        severity: RULE_CATALOG.R6.severity,
        message: `Hafta sonu ${saturday}/${sunday} araç sayısı hafta içi ortalamasının (${weekdayAverage.toFixed(1)}) altında.`,
      })
    }
  }

  // R15 — printed weekly total must equal the sum of daily counts.
  if (snapshot.reportedWeeklyVehicleDays !== undefined) {
    const computed = snapshot.assignments.filter((a) => a.status === 'duty').length
    if (computed !== snapshot.reportedWeeklyVehicleDays) {
      violations.push({
        code: 'R15',
        severity: RULE_CATALOG.R15.severity,
        message: `Haftalık toplam ${computed}, tabloda yazan ${snapshot.reportedWeeklyVehicleDays}.`,
      })
    }
  }

  // R17 — standby balance over the 7-week cycle.
  const standbyTotals = new Map<string, number>()
  for (const standby of snapshot.standbyHistory ?? []) {
    standbyTotals.set(standby.vehicleId, (standbyTotals.get(standby.vehicleId) ?? 0) + 1)
  }
  for (const standby of snapshot.standbys) {
    standbyTotals.set(standby.vehicleId, (standbyTotals.get(standby.vehicleId) ?? 0) + 1)
  }
  if (standbyTotals.size > 0) {
    const totals = [...standbyTotals.values()]
    const min = Math.min(...totals)
    const max = Math.max(...totals)
    if (max - min > 1) {
      for (const [vehicleId, total] of standbyTotals) {
        if (total === max) {
          violations.push({
            code: 'R17',
            severity: RULE_CATALOG.R17.severity,
            vehicleId,
            message: `${plateOf(vehicleById, vehicleId)} son 7 haftada ${total} nöbet günü almış; dengeli dağılımda en fazla ${min + 1} olmalı.`,
          })
        }
      }
    }
  }

  // R18 — no duty the day after a standby day.
  const standbyDays = new Set(snapshot.standbys.map((s) => `${s.vehicleId}:${s.dayIndex}`))
  for (const assignment of snapshot.assignments) {
    if (assignment.status !== 'duty') continue
    const previousDay = assignment.dayIndex - 1
    if (previousDay < 1) continue
    if (!standbyDays.has(`${assignment.vehicleId}:${previousDay}`)) continue
    const date = dateOf(dayByIndex, assignment.dayIndex)
    violations.push({
      code: 'R18',
      severity: RULE_CATALOG.R18.severity,
      dayIndex: assignment.dayIndex,
      vehicleId: assignment.vehicleId,
      message: `${plateOf(vehicleById, assignment.vehicleId)} ${date} günü nöbetçiydi, ertesi gün yeniden atama almış.`,
    })
  }

  // R10 / L1-L5 — driver duties.
  const rosterByDriver = new Map<string, (typeof snapshot.roster)[number][]>()
  for (const entry of snapshot.roster) {
    const list = rosterByDriver.get(entry.driverId) ?? []
    list.push(entry)
    rosterByDriver.set(entry.driverId, list)

    for (const issue of evaluateDutySpan({
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
      drivingMinutes: entry.drivingMinutes,
      breakMinutes: entry.breakMinutes,
    })) {
      violations.push({
        code: issue.code,
        severity: DRIVER_RULE_CATALOG[issue.code].severity,
        dayIndex: entry.dayIndex,
        driverId: entry.driverId,
        vehicleId: entry.vehicleId,
        message: issue.message,
      })
    }
  }

  for (const [driverId, entries] of rosterByDriver) {
    const sorted = [...entries].sort((a, b) => a.dayIndex - b.dayIndex)
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (previous === undefined || current === undefined) continue
      const previousDate = dateOf(dayByIndex, previous.dayIndex)
      const currentDate = dateOf(dayByIndex, current.dayIndex)
      if (previousDate === undefined || currentDate === undefined) continue

      for (const issue of evaluateRest(
        { date: previousDate, endMinute: previous.endMinute },
        { date: currentDate, startMinute: current.startMinute },
      )) {
        violations.push({
          code: issue.code,
          severity: DRIVER_RULE_CATALOG[issue.code].severity,
          dayIndex: current.dayIndex,
          driverId,
          message: issue.message,
        })
      }
    }

    let streak = 1
    let longest = 1
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (previous === undefined || current === undefined) continue
      streak = current.dayIndex === previous.dayIndex + 1 ? streak + 1 : 1
      longest = Math.max(longest, streak)
    }
    if (longest > LABOUR_LIMITS.maxConsecutiveWorkDays) {
      violations.push({
        code: 'L5',
        severity: DRIVER_RULE_CATALOG.L5.severity,
        driverId,
        message: `Şoför ${longest} gün üst üste çalışmış, en fazla ${LABOUR_LIMITS.maxConsecutiveWorkDays} olmalı.`,
      })
    }
  }

  return violations.sort(compareViolations)
}

/** True when a violation forbids publishing the plan. */
export function blocksPublishing(violations: readonly Violation[]): boolean {
  return violations.some((violation) =>
    violation.code in RULE_CATALOG
      ? RULE_CATALOG[violation.code as RuleCode].blocksPublish
      : (DRIVER_RULE_CATALOG[violation.code as keyof typeof DRIVER_RULE_CATALOG]?.blocksPublish ?? false),
  )
}

function compareViolations(a: Violation, b: Violation): number {
  if (a.code !== b.code) return a.code.localeCompare(b.code)
  const dayDiff = (a.dayIndex ?? 0) - (b.dayIndex ?? 0)
  if (dayDiff !== 0) return dayDiff
  return (a.vehicleId ?? '').localeCompare(b.vehicleId ?? '')
}

function plateOf(vehicles: Map<string, { plate: string }>, vehicleId: string): string {
  return vehicles.get(vehicleId)?.plate ?? vehicleId
}

function dateOf(days: Map<number, { date: string }>, dayIndex: number): string | undefined {
  return days.get(dayIndex)?.date
}

function dayLabel(dayIndex: number): string {
  const day = ROTATION_DAYS[dayIndex - 1]
  return day === undefined ? String(dayIndex) : printLabel(day)
}

function statusLabel(status: string): string {
  return status === 'maintenance' ? 'bakımda' : status === 'retired' ? 'hizmet dışı' : status
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
