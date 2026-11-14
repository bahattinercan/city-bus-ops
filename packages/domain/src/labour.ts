/**
 * Driver working-time limits (new in this system — the legacy catalogue had no driver
 * model). Defaults mirror the reference bus-driver scheduling model (Google OR-Tools
 * `bus_driver_scheduling_flow_sat.py`) and are **pending operator confirmation**.
 */
export const LABOUR_LIMITS = {
  /** L1 — driving time per duty. */
  maxDrivingMinutes: 9 * 60,
  /** L2 — duty span from sign-on to sign-off. */
  maxDutyMinutes: 12 * 60,
  /** Soft floor used by run cutting when choosing duties. */
  targetMinDutyMinutes: 6 * 60 + 30,
  /** L3 — a 30 minute break after each 4 hours of driving. */
  breakAfterDrivingMinutes: 4 * 60,
  breakMinutes: 30,
  /** L4 — rest between the end of one duty and the start of the next (11 hours). */
  minRestBetweenDutiesMinutes: 11 * 60,
  /** L5 — consecutive working days before a weekly rest. */
  maxConsecutiveWorkDays: 6,
  /** Sign-on / sign-off allowance around the first and last trip. */
  preparationMinutes: 10,
  cleaningMinutes: 15,
} as const

export type DutySpan = {
  /** Minutes after midnight; may exceed 1440 when the duty ends after midnight. */
  readonly startMinute: number
  readonly endMinute: number
  readonly drivingMinutes: number
  readonly breakMinutes: number
}

export type LabourIssue = {
  readonly code: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  readonly message: string
  /** Stable message id plus data for the UI translation layer (see Violation.key). */
  readonly key: string
  readonly params: Readonly<Record<string, string | number>>
}

export function dutyMinutes(span: Pick<DutySpan, 'startMinute' | 'endMinute'>): number {
  return span.endMinute - span.startMinute
}

/** L1, L2, L3 for a single duty. */
export function evaluateDutySpan(span: DutySpan): LabourIssue[] {
  const issues: LabourIssue[] = []
  const span_ = dutyMinutes(span)

  if (span.drivingMinutes > LABOUR_LIMITS.maxDrivingMinutes) {
    issues.push({
      code: 'L1',
      key: 'L1.drivingTooLong',
      params: {
        driving: formatMinutes(span.drivingMinutes),
        limit: formatMinutes(LABOUR_LIMITS.maxDrivingMinutes),
      },
      message: `Sürüş süresi ${formatMinutes(span.drivingMinutes)}, en fazla ${formatMinutes(LABOUR_LIMITS.maxDrivingMinutes)} olmalı.`,
    })
  }

  if (span_ > LABOUR_LIMITS.maxDutyMinutes) {
    issues.push({
      code: 'L2',
      key: 'L2.dutyTooLong',
      params: { duty: formatMinutes(span_), limit: formatMinutes(LABOUR_LIMITS.maxDutyMinutes) },
      message: `Görev süresi ${formatMinutes(span_)}, en fazla ${formatMinutes(LABOUR_LIMITS.maxDutyMinutes)} olmalı.`,
    })
  }

  const requiredBreaks = Math.floor(span.drivingMinutes / LABOUR_LIMITS.breakAfterDrivingMinutes)
  const requiredBreakMinutes = requiredBreaks * LABOUR_LIMITS.breakMinutes
  if (span.breakMinutes < requiredBreakMinutes) {
    issues.push({
      code: 'L3',
      key: 'L3.breakTooShort',
      params: {
        driving: formatMinutes(span.drivingMinutes),
        required: requiredBreakMinutes,
        given: span.breakMinutes,
      },
      message: `${formatMinutes(span.drivingMinutes)} sürüş için ${requiredBreakMinutes} dk mola gerekli, verilen ${span.breakMinutes} dk.`,
    })
  }

  return issues
}

/**
 * L4 — rest between two duties. `previousEndMinute` is measured from the previous duty's
 * start day, so an overnight duty may be larger than 1440 and one day (1440) is added.
 */
export function restMinutes(
  previous: { readonly date: string; readonly endMinute: number },
  next: { readonly date: string; readonly startMinute: number },
): number {
  const days = daysBetween(previous.date, next.date)
  return next.startMinute + days * 1440 - previous.endMinute
}

export function evaluateRest(
  previous: { readonly date: string; readonly endMinute: number },
  next: { readonly date: string; readonly startMinute: number },
): LabourIssue[] {
  const rest = restMinutes(previous, next)
  if (rest >= LABOUR_LIMITS.minRestBetweenDutiesMinutes) {
    return []
  }
  return [
    {
      code: 'L4',
      key: 'L4.restTooShort',
      params: {
        rest: formatMinutes(rest),
        limit: formatMinutes(LABOUR_LIMITS.minRestBetweenDutiesMinutes),
      },
      message: `İki görev arasında ${formatMinutes(rest)} dinlenme var, en az ${formatMinutes(LABOUR_LIMITS.minRestBetweenDutiesMinutes)} olmalı.`,
    },
  ]
}

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`)
  const toMs = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new Error(`Invalid service date: ${from} / ${to}`)
  }
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000))
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const absolute = Math.abs(minutes)
  const hours = Math.floor(absolute / 60)
  const rest = absolute % 60
  return `${sign}${hours}s ${String(rest).padStart(2, '0')}dk`
}
