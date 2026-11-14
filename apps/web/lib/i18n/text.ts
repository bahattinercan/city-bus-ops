import { en } from './dictionaries/en'
import { tr } from './dictionaries/tr'
import type { Locale } from './locale'
import type { Messages } from './dictionaries/tr'

/**
 * Pure translation helpers. Deliberately free of `next/headers`: client components import
 * this module (with the dictionary handed down as a prop), the server imports the index.
 */
export type { Messages } from './dictionaries/tr'

export const MESSAGES: Readonly<Record<Locale, Messages>> = { tr, en }

/** `{name}` placeholders, replaced in one pass so a value may contain braces. */
export function format(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    return value === undefined ? match : String(value)
  })
}

const DAY_TYPE_BY_INDEX: Readonly<Record<number, keyof Messages['days']>> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
}

export function dayLabel(m: Messages, dayType: string): string {
  const days: Record<string, string> = m.days
  return days[dayType] ?? dayType
}

export function dayLabelByIndex(m: Messages, dayIndex: number): string {
  const dayType = DAY_TYPE_BY_INDEX[dayIndex]
  return dayType === undefined ? String(dayIndex) : m.days[dayType]
}

export function roleLabel(m: Messages, role: string): string {
  const roles: Record<string, string> = m.roles
  return roles[role] ?? role
}

export function severityLabel(m: Messages, severity: string): string {
  return severity === 'hard' ? m.severity.hard : m.severity.soft
}

/** Rule titles come from the domain in English; the UI always renders its own copy. */
export function ruleTitle(m: Messages, code: string): string | undefined {
  const rules: Record<string, string> = m.rules
  if (code in rules) return rules[code]

  const driverRules: Record<string, string> = m.driverRules
  if (code in driverRules) return driverRules[code]

  return undefined
}

type Translatable = {
  readonly code: string
  readonly message: string
  readonly key?: string
  readonly params?: Readonly<Record<string, string | number>>
}

/**
 * Renders a violation in the interface language. The domain sentence stays the fallback: a
 * violation without a `key` (an older call site or a new rule) is still shown, never hidden.
 */
export function violationText(m: Messages, violation: Translatable): string {
  const templates: Record<string, string> = m.violations
  const template = violation.key === undefined ? undefined : templates[violation.key]
  if (template === undefined) return violation.message
  return format(template, violation.params ?? {})
}

/**
 * Server actions redirect with a key (`?error=generateFirst`) or, for a one-off case, a plain
 * sentence. Keys win; anything unknown is shown verbatim so nothing is swallowed.
 */
export function errorText(
  m: Messages,
  value: string | undefined,
  params: Readonly<Record<string, string | number>> = {},
): string | undefined {
  if (value === undefined || value === '') return undefined
  const errors: Record<string, string> = m.errors
  const template = errors[value]
  return template === undefined ? value : format(template, params)
}
