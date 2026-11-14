import Link from 'next/link'
import { sql } from 'drizzle-orm'
import {
  DRIVER_RULE_CATALOG,
  DRIVER_RULE_CODES,
  LABOUR_LIMITS,
  ROTATION_CYCLE_WEEKS,
  RULE_CATALOG,
  RULE_CODES,
} from '@citybus/domain'
import { requireSession } from '@/lib/auth'
import { allRows, getOrganisation } from '@/lib/db'
import { format, getMessages, roleLabel, type Messages } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

type StepKey = 'network' | 'plan' | 'drivers' | 'reports' | 'driver'

type Step = {
  readonly key: StepKey
  /** roles that actually reach this screen */
  readonly audience: readonly string[]
  readonly href: string
}

const STEPS: readonly Step[] = [
  { key: 'network', audience: ['admin', 'planner'], href: '/network' },
  { key: 'plan', audience: ['admin', 'planner', 'dispatcher'], href: '/plan' },
  { key: 'drivers', audience: ['admin', 'planner', 'dispatcher'], href: '/drivers' },
  { key: 'reports', audience: ['admin', 'planner', 'dispatcher'], href: '/reports' },
  { key: 'driver', audience: ['driver'], href: '/driver' },
]

/** Which snags are worth showing to which role, in the order the operator meets them. */
const TIP_KEYS = [
  { key: 'noPlan', audience: ['admin', 'planner', 'dispatcher'] },
  { key: 'notPublishing', audience: ['admin', 'planner', 'dispatcher'] },
  { key: 'cellNotChanging', audience: ['admin', 'planner', 'dispatcher'] },
  { key: 'swapMissing', audience: ['admin', 'planner', 'dispatcher'] },
  { key: 'driverUnlinked', audience: ['admin', 'planner', 'dispatcher'] },
  { key: 'emptyWeek', audience: ['driver'] },
  { key: 'defectMissing', audience: ['driver'] },
] as const

const ROLE_MATRIX: ReadonlyArray<{ key: keyof Messages['help']['stepTitles']; roles: readonly boolean[] }> =
  [
    { key: 'network', roles: [true, true, false, false] },
    { key: 'plan', roles: [true, true, true, false] },
    { key: 'drivers', roles: [true, true, true, false] },
    { key: 'reports', roles: [true, true, true, false] },
    { key: 'driver', roles: [false, false, false, true] },
  ]

const MATRIX_ROLES = ['admin', 'planner', 'dispatcher', 'driver'] as const

function state(organisationId: string): { trips: number; plans: number } {
  const [row] = allRows<{ trips: number; plans: number }>(sql`
    select
      (select count(*) from trip t
        join route r on r.id = t.route_id
        where r.organisation_id = ${organisationId}) as trips,
      (select count(*) from plan_version where organisation_id = ${organisationId}) as plans
  `)
  return { trips: Number(row?.trips ?? 0), plans: Number(row?.plans ?? 0) }
}

const HARD_RULES = RULE_CODES.filter((code) => RULE_CATALOG[code].severity === 'hard')
const SOFT_RULES = RULE_CODES.filter((code) => RULE_CATALOG[code].severity === 'soft')
const HARD_DRIVER_RULES = DRIVER_RULE_CODES.filter(
  (code) => DRIVER_RULE_CATALOG[code].severity === 'hard',
)
const SOFT_DRIVER_RULES = DRIVER_RULE_CODES.filter(
  (code) => DRIVER_RULE_CATALOG[code].severity === 'soft',
)

export default async function HelpPage() {
  const session = await requireSession(['admin', 'planner', 'dispatcher', 'driver'])
  const { m } = await getMessages()
  const organisation = await getOrganisation()
  const { trips, plans } = state(organisation.id)
  const steps = STEPS.filter((step) => step.audience.includes(session.role))
  const tips = TIP_KEYS.filter((tip) => (tip.audience as readonly string[]).includes(session.role))
  const office = session.role !== 'driver'

  const current: StepKey | null =
    session.role === 'driver' ? 'driver' : trips === 0 ? 'network' : plans === 0 ? 'plan' : 'reports'

  return (
    <>
      <h1>{m.help.title}</h1>
      <p className="lead">
        <span>{organisation.name}</span>
        <span className="badge">{format(m.help.roleBadge, { role: roleLabel(m, session.role) })}</span>
        <span className="badge">{format(m.help.cycleBadge, { weeks: ROTATION_CYCLE_WEEKS })}</span>
        <span className="muted">{m.help.order}</span>
      </p>

      <h3>{m.help.steps}</h3>
      <div className="steps">
        {steps.map((step, index) => (
          <section key={step.key} className={step.key === current ? 'step step-now' : 'step'}>
            <div className="step-head">
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <h2>{m.help.stepTitles[step.key]}</h2>
              <span className="badge">{m.help.stepRoles[step.key]}</span>
              {step.key === current && (
                <span className="badge ok">
                  <span className="led ok" />
                  {m.help.startHere}
                </span>
              )}
            </div>
            <p className="step-body">{m.help.stepBodies[step.key]}</p>
            <Link className="step-link" href={step.href}>
              {format(m.help.openScreen, { screen: m.help.stepTitles[step.key] })} →
            </Link>
          </section>
        ))}
      </div>

      <h3>{m.help.readTable}</h3>
      <p className="hint">{m.help.readTableHint}</p>
      <table>
        <thead>
          <tr>
            <th>{m.help.cellCode}</th>
            <th>{m.help.meaning}</th>
          </tr>
        </thead>
        <tbody>
          {m.help.cellCodes.map((row) => (
            <tr key={row.code}>
              <td>
                <strong>{row.code}</strong>
              </td>
              <td className="muted">{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{m.help.rulesTitle}</h3>
      <p className="hint">
        {format(m.help.rulesHint, {
          rules: RULE_CODES.length,
          driverRules: DRIVER_RULE_CODES.length,
          driving: LABOUR_LIMITS.maxDrivingMinutes / 60,
          duty: LABOUR_LIMITS.maxDutyMinutes / 60,
          rest: LABOUR_LIMITS.minRestBetweenDutiesMinutes / 60,
        })}
      </p>
      <table>
        <thead>
          <tr>
            <th>{m.common.group}</th>
            <th className="num">{m.common.count}</th>
            <th>{m.common.code}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="badge hard">{m.severity.hard}</span> {m.help.hardBlocks}
            </td>
            <td className="num">{HARD_RULES.length + HARD_DRIVER_RULES.length}</td>
            <td className="muted">{[...HARD_RULES, ...HARD_DRIVER_RULES].join(' · ')}</td>
          </tr>
          <tr>
            <td>
              <span className="badge soft">{m.severity.soft}</span> {m.help.softWarns}
            </td>
            <td className="num">{SOFT_RULES.length + SOFT_DRIVER_RULES.length}</td>
            <td className="muted">{[...SOFT_RULES, ...SOFT_DRIVER_RULES].join(' · ')}</td>
          </tr>
        </tbody>
      </table>
      {office && <p className="hint">{m.help.violationHint}</p>}

      <h3>{m.help.rolesTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{m.common.screen}</th>
            {MATRIX_ROLES.map((role) => (
              <th key={role} className="num">
                {roleLabel(m, role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROLE_MATRIX.map((row) => (
            <tr key={row.key}>
              <td>{m.help.stepTitles[row.key]}</td>
              {row.roles.map((allowed, index) => (
                <td key={index} className="num">
                  {allowed ? m.common.yes : m.common.no}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{m.help.outputsTitle}</h3>
      <table>
        <tbody>
          <tr>
            <td>{m.help.gtfsRow}</td>
            <td className="muted">
              <Link href="/api/gtfs">{m.common.downloadZip}</Link> — {m.help.gtfsValue}
            </td>
          </tr>
          {office && (
            <tr>
              <td>{m.help.weeklyRow}</td>
              <td className="muted">{m.help.weeklyValue}</td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>{m.help.tipsTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{m.help.symptom}</th>
            <th>{m.help.cause}</th>
          </tr>
        </thead>
        <tbody>
          {tips.map((tip) => (
            <tr key={tip.key}>
              <td>{m.help.tips[tip.key].symptom}</td>
              <td className="muted">{m.help.tips[tip.key].cause}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
