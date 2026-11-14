import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { cyclePosition } from '@citybus/domain'
import { requireSession } from '@/lib/auth'
import { getOrganisation, allRows } from '@/lib/db'
import { format, getMessages } from '@/lib/i18n'
import { mondayOf, weeksBetween } from '@/lib/plan'

export const dynamic = 'force-dynamic'

async function counts(organisationId: string) {
  const [row] = allRows<{
    vehicles: number
    routes: number
    stops: number
    trips: number
    drivers: number
    plans: number
  }>(sql`
    select
      (select count(*) from vehicle where organisation_id = ${organisationId}) as vehicles,
      (select count(*) from route where organisation_id = ${organisationId}) as routes,
      (select count(*) from stop where organisation_id = ${organisationId}) as stops,
      (select count(*) from trip t
        join route r on r.id = t.route_id
        where r.organisation_id = ${organisationId}) as trips,
      (select count(*) from driver where organisation_id = ${organisationId}) as drivers,
      (select count(*) from plan_version where organisation_id = ${organisationId}) as plans
  `)
  return {
    vehicles: Number(row?.vehicles ?? 0),
    routes: Number(row?.routes ?? 0),
    stops: Number(row?.stops ?? 0),
    trips: Number(row?.trips ?? 0),
    drivers: Number(row?.drivers ?? 0),
    plans: Number(row?.plans ?? 0),
  }
}

/** Seven bodies on one orbit: the rotation week decides which one is lit. */
const ORBIT_BODIES = Array.from({ length: 7 }, (_, index) => {
  const angle = (index / 7) * Math.PI * 2 - Math.PI / 2
  return {
    week: index + 1,
    x: Number((60 + 46 * Math.cos(angle)).toFixed(2)),
    y: Number((60 + 46 * Math.sin(angle)).toFixed(2)),
  }
})

export default async function Home() {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const { m } = await getMessages()
  const organisation = await getOrganisation()
  const summary = await counts(organisation.id)
  const stamp = new Date().toISOString().slice(11, 16)

  const thisMonday = mondayOf(new Date().toISOString().slice(0, 10))
  const cycle = cyclePosition(weeksBetween(organisation.rotationAnchorWeek, thisMonday))

  return (
    <>
      <h1>{m.home.title}</h1>
      <p className="lead">
        <span>{organisation.name}</span>
        <span className="badge">
          {m.home.anchor} {organisation.rotationAnchorWeek}
        </span>
        <span className="badge">{m.home.cycle}</span>
        <span className="muted">
          {m.common.lastUpdate} {stamp} UTC
        </span>
      </p>

      <div className="split">
        <div className="grid">
          <div className="card">
            <div className="label">{m.home.cards.vehicles}</div>
            <div className="value">
              {summary.vehicles}
              <span className="unit">{m.common.units.vehicles}</span>
            </div>
          </div>
          <div className="card">
            <div className="label">{m.home.cards.routes}</div>
            <div className="value">
              {summary.routes}
              <span className="unit">{m.common.units.routes}</span>
            </div>
          </div>
          <div className="card">
            <div className="label">{m.home.cards.stops}</div>
            <div className="value">
              {summary.stops}
              <span className="unit">{m.common.units.stops}</span>
            </div>
          </div>
          <div className={summary.trips === 0 ? 'card warn' : 'card'}>
            <div className="label">{m.home.cards.trips}</div>
            <div className="value">
              {summary.trips}
              <span className="unit">{m.common.units.trips}</span>
            </div>
            <div className="foot">
              <span className={summary.trips === 0 ? 'led warn' : 'led ok'} />
              {summary.trips === 0 ? m.home.timetableEmpty : m.home.timetableReady}
            </div>
          </div>
          <div className="card">
            <div className="label">{m.home.cards.drivers}</div>
            <div className="value">
              {summary.drivers}
              <span className="unit">{m.common.units.people}</span>
            </div>
          </div>
          <div className="card">
            <div className="label">{m.home.cards.planWeeks}</div>
            <div className="value">
              {summary.plans}
              <span className="unit">{m.common.units.weeks}</span>
            </div>
          </div>
        </div>

        <section className="orbit-panel" aria-label={m.home.rotationAria}>
          <div className="label">{m.home.rotation}</div>
          <div className="orbit-field">
            <svg
              className="orbit"
              viewBox="0 0 120 120"
              role="img"
              aria-label={format(m.home.rotationWeekAria, { week: cycle })}
            >
              <circle className="ring-inner" cx="60" cy="60" r="28" />
              <circle className="ring-outer" cx="60" cy="60" r="46" />
              {ORBIT_BODIES.map((body) => (
                <circle
                  key={body.week}
                  className={body.week === cycle ? 'body current' : 'body'}
                  cx={body.x}
                  cy={body.y}
                  r="3"
                />
              ))}
              <text className="centre-value" x="60" y="58">
                {cycle}/7
              </text>
              <text className="centre-label" x="60" y="72">
                {m.home.rotationUnit}
              </text>
            </svg>
          </div>
          <div className="foot">
            <span className="led live" />
            {format(m.home.rotationFoot, { date: thisMonday })}
          </div>
        </section>
      </div>

      <h3>{m.home.nextStep}</h3>
      {summary.trips === 0 ? (
        <div className="notice warn">{m.home.nextStepEmpty}</div>
      ) : (
        <div className="notice">{m.home.nextStepPlan}</div>
      )}

      <h3>{m.home.system}</h3>
      <table>
        <tbody>
          <tr>
            <td>{m.home.systemRules}</td>
            <td className="muted">{m.home.systemRulesValue}</td>
          </tr>
          <tr>
            <td>{m.home.systemRotation}</td>
            <td className="muted">{m.home.systemRotationValue}</td>
          </tr>
          <tr>
            <td>{m.home.systemOutputs}</td>
            <td className="muted">
              <Link href="/api/gtfs">{m.home.gtfsArchive}</Link> {m.home.outputsTail}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
