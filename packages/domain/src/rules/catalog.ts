import type { DayIndex } from '../rotation'

/**
 * Rule catalogue (legacy R1-R18). Severity and meaning are taken unchanged from
 * `docs/legacy-data-model-and-scheduler.md` §5 — the operator agreed on these
 * classifications, so they are data here, not opinions of the code.
 */
export const RULE_CODES = [
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
  'R10',
  'R11',
  'R12',
  'R13',
  'R14',
  'R15',
  'R16',
  'R17',
  'R18',
] as const

export type RuleCode = (typeof RULE_CODES)[number]
export type RuleSeverity = 'hard' | 'soft'

export type RuleDefinition = {
  readonly code: RuleCode
  readonly title: string
  readonly severity: RuleSeverity
  /** Hard rules block publishing a plan; soft rules only score and warn. */
  readonly blocksPublish: boolean
}

export const RULE_CATALOG: Readonly<Record<RuleCode, RuleDefinition>> = {
  R1: { code: 'R1', title: 'A vehicle takes at most one assignment per day', severity: 'hard', blocksPublish: true },
  R2: { code: 'R2', title: 'A trip is operated by exactly one vehicle per day', severity: 'hard', blocksPublish: true },
  R3: { code: 'R3', title: 'A vehicle that is broken, absent or under maintenance gets no duty', severity: 'hard', blocksPublish: true },
  R4: { code: 'R4', title: 'An idle (YAT) assignment carries no route, trip or shift data', severity: 'hard', blocksPublish: true },
  R5: { code: 'R5', title: 'Daily active vehicle count stays inside the target range', severity: 'soft', blocksPublish: false },
  R6: { code: 'R6', title: 'Weekend vehicle count is not below the weekday average', severity: 'soft', blocksPublish: false },
  R7: { code: 'R7', title: 'Duty group falls on the weekday required by the 7-week rotation', severity: 'hard', blocksPublish: true },
  R8: { code: 'R8', title: 'A locked (hand-corrected) assignment cannot be changed', severity: 'hard', blocksPublish: true },
  R9: { code: 'R9', title: 'At most one standby day per vehicle per week, standby carries a route code', severity: 'hard', blocksPublish: true },
  R10: { code: 'R10', title: 'Shift chain keeps the minimum rest period', severity: 'hard', blocksPublish: true },
  R11: { code: 'R11', title: 'A duty crossing midnight is flagged as such', severity: 'hard', blocksPublish: true },
  R12: { code: 'R12', title: 'Vehicle meets the route equipment requirement', severity: 'hard', blocksPublish: true },
  R13: { code: 'R13', title: 'Group vehicle count matches its definition', severity: 'soft', blocksPublish: false },
  R14: { code: 'R14', title: 'A duty group is assigned to a single weekday per week', severity: 'hard', blocksPublish: true },
  R15: { code: 'R15', title: 'Weekly vehicle-days equal the sum of daily counts', severity: 'hard', blocksPublish: true },
  R16: { code: 'R16', title: 'Trip set matches the day type (Saturday/Sunday timetables are separate)', severity: 'hard', blocksPublish: true },
  R17: { code: 'R17', title: 'Standby days are balanced across the 7-week cycle (±1)', severity: 'soft', blocksPublish: false },
  R18: { code: 'R18', title: 'No duty on the day after a standby day', severity: 'soft', blocksPublish: false },
}

export const HARD_RULES: readonly RuleCode[] = RULE_CODES.filter(
  (code) => RULE_CATALOG[code].severity === 'hard',
)

export const SOFT_RULES: readonly RuleCode[] = RULE_CODES.filter(
  (code) => RULE_CATALOG[code].severity === 'soft',
)

/**
 * Driver working-time rules. The legacy catalogue had no driver model (decision K2),
 * so these codes are new in this system. Defaults follow the reference bus-driver
 * scheduling model (Google OR-Tools example) and must be confirmed with the operator.
 */
export const DRIVER_RULE_CODES = ['L1', 'L2', 'L3', 'L4', 'L5'] as const

export type DriverRuleCode = (typeof DRIVER_RULE_CODES)[number]

export type DriverRuleDefinition = {
  readonly code: DriverRuleCode
  readonly title: string
  readonly severity: RuleSeverity
  readonly blocksPublish: boolean
}

export const DRIVER_RULE_CATALOG: Readonly<Record<DriverRuleCode, DriverRuleDefinition>> = {
  L1: { code: 'L1', title: 'Driving time per duty within the legal maximum', severity: 'hard', blocksPublish: true },
  L2: { code: 'L2', title: 'Duty span within the maximum working window', severity: 'hard', blocksPublish: true },
  L3: { code: 'L3', title: 'Break after continuous driving', severity: 'hard', blocksPublish: true },
  L4: { code: 'L4', title: 'Minimum rest between two duties', severity: 'hard', blocksPublish: true },
  L5: { code: 'L5', title: 'Maximum consecutive working days', severity: 'soft', blocksPublish: false },
}

/** Day indexes used by the rotation law, Monday = 1. */
export const ALL_DAY_INDEXES: readonly DayIndex[] = [1, 2, 3, 4, 5, 6, 7]
