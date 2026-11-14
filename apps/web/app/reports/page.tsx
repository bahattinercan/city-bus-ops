import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { auditLog, defectReports, drivers, planVersions, ruleViolations } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { allRows, getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, format, getMessages, ruleTitle, severityLabel } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const { m } = await getMessages()
  const params = await searchParams
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)

  const [violationSummary, driverCount, openDefects, planRows, auditRows] = await Promise.all([
    plan.version === null
      ? Promise.resolve([])
      : db
          .select({
            code: ruleViolations.code,
            severity: ruleViolations.severity,
            count: sql<number>`count(*)`,
          })
          .from(ruleViolations)
          .where(eq(ruleViolations.planVersionId, plan.version.id))
          .groupBy(ruleViolations.code, ruleViolations.severity)
          .orderBy(ruleViolations.code),
    db.select({ count: sql<number>`count(*)` }).from(drivers).where(eq(drivers.organisationId, organisation.id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(defectReports)
      .where(and(eq(defectReports.organisationId, organisation.id), eq(defectReports.status, 'open'))),
    db
      .select()
      .from(planVersions)
      .where(eq(planVersions.organisationId, organisation.id))
      .orderBy(desc(planVersions.weekStart))
      .limit(8),
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organisationId, organisation.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(15),
  ])

  const dutyPerDay = new Map<number, number>()
  for (const assignment of plan.snapshot.assignments) {
    if (assignment.status !== 'duty') continue
    dutyPerDay.set(assignment.dayIndex, (dutyPerDay.get(assignment.dayIndex) ?? 0) + 1)
  }
  const dutyTotal = [...dutyPerDay.values()].reduce((sum, value) => sum + value, 0)
  const standbyTotal = plan.snapshot.standbys.length
  const vehicleCount = plan.snapshot.vehicles.filter((vehicle) => vehicle.status === 'active').length

  const kpi = allRows<{ minutes: number; trips: number }>(sql`
    select coalesce(sum(t.end_minute - t.start_minute), 0) as minutes,
           count(*) as trips
    from trip t
    join route r on r.id = t.route_id
    where r.organisation_id = ${organisation.id}
  `)
  const tripMinutes = Number(kpi[0]?.minutes ?? 0)
  const tripCount = Number(kpi[0]?.trips ?? 0)

  const stamp = new Date().toISOString().slice(11, 16)

  return (
    <>
      <h1>{m.reports.title}</h1>
      <p className="lead">
        <span>{organisation.name}</span>
        <span className="badge">{format(m.plan.weekBadge, { week: weekStart })}</span>
        <span className="muted">
          {m.common.lastUpdate} {stamp} UTC
        </span>
      </p>

      <form className="inline" action="/reports">
        <label>
          {m.common.week}
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit">{m.common.go}</button>
        <Link href={`/api/plan/xlsx?week=${weekStart}`} className="button-link">
          {m.common.excel}
        </Link>
      </form>

      <div className="grid">
        <div className="card">
          <div className="label">{m.reports.weeklyDuty}</div>
          <div className="value">
            {dutyTotal}
            <span className="unit">{m.reports.units.vehicleDays}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">{m.reports.standbyDays}</div>
          <div className="value">
            {standbyTotal}
            <span className="unit">{m.reports.units.days}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">{m.reports.driverAssignments}</div>
          <div className="value">
            {plan.snapshot.roster.length}
            <span className="unit">{m.reports.units.assignments}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">{m.home.cards.drivers}</div>
          <div className="value">
            {driverCount[0]?.count ?? 0}
            <span className="unit">{m.common.units.people}</span>
          </div>
        </div>
        <div className="card">
          <div className="label">{m.reports.activeVehicles}</div>
          <div className="value">
            {vehicleCount}
            <span className="unit">{m.common.units.vehicles}</span>
          </div>
        </div>
        <div className={openDefects[0] === undefined || openDefects[0].count > 0 ? 'card crit' : 'card ok'}>
          <div className="label">{m.reports.openDefects}</div>
          <div className="value">
            {openDefects[0]?.count ?? 0}
            <span className="unit">{m.reports.units.records}</span>
          </div>
          <div className="foot">
            <span className={openDefects[0] === undefined || openDefects[0].count > 0 ? 'led crit' : 'led ok'} />
            {openDefects[0] === undefined || openDefects[0].count > 0 ? 'CRIT' : 'OK'}
          </div>
        </div>
        <div className="card">
          <div className="label">{m.reports.definedTrips}</div>
          <div className="value">
            {tripCount}
            <span className="unit">adet</span>
          </div>
        </div>
        <div className="card">
          <div className="label">{m.reports.timetableHours}</div>
          <div className="value">
            {Math.round(tripMinutes / 60)}
            <span className="unit">{m.reports.units.hours}</span>
          </div>
          <div className="foot">{m.reports.totalSpan}</div>
        </div>
      </div>

      <h3>{m.reports.daily}</h3>
      <table>
        <thead>
          <tr>
            <th>{m.common.day}</th>
            <th>{m.common.date}</th>
            <th className="num">{m.driver.duty}</th>
            <th className="num">{m.reports.standbyDays}</th>
          </tr>
        </thead>
        <tbody>
          {plan.snapshot.days.map((day) => (
            <tr key={day.dayIndex}>
              <td>{dayLabel(m, day.dayType)}</td>
              <td className="muted">{day.date}</td>
              <td className="num">{dutyPerDay.get(day.dayIndex) ?? 0}</td>
              <td className="num">
                {plan.snapshot.standbys.filter((standby) => standby.dayIndex === day.dayIndex).length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{m.reports.violations}</h3>
      {violationSummary.length === 0 ? (
        <div className="notice">{m.reports.noViolations}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{m.common.rule}</th>
              <th>{m.severity.title}</th>
              <th className="num">{m.common.count}</th>
            </tr>
          </thead>
          <tbody>
            {violationSummary.map((row) => (
              <tr key={`${row.code}-${row.severity}`}>
                <td>
                  <strong>{row.code}</strong>{' '}
                  <span className="muted">
                    {ruleTitle(m, row.code) ?? m.plan.driverRule}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.severity}`}>{severityLabel(m, row.severity)}</span>
                </td>
                <td className="num">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{m.reports.auditTitle}</h3>
      {auditRows.length === 0 ? (
        <div className="notice">{m.reports.noAudit}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{m.reports.at}</th>
              <th>{m.reports.action}</th>
              <th>{m.reports.entity}</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <tr key={row.id}>
                <td className="muted">{row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <strong>{row.action}</strong>
                </td>
                <td className="muted">
                  {row.entity}
                  {row.entityId === null ? '' : ` · ${row.entityId.slice(0, 8)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{m.reports.history}</h3>
      <table>
        <thead>
          <tr>
            <th>{m.common.week}</th>
            <th>{m.common.status}</th>
            <th>{m.reports.publishedAt}</th>
          </tr>
        </thead>
        <tbody>
          {planRows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/plan?week=${row.weekStart}`}>{row.weekStart}</Link>
              </td>
              <td>
                <span className="badge">{row.status}</span>
              </td>
              <td className="muted">
                {row.publishedAt === null
                  ? m.common.none
                  : row.publishedAt.toISOString().slice(0, 16).replace('T', ' ')}
              </td>
            </tr>
          ))}
          {planRows.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                {m.reports.noHistory}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
