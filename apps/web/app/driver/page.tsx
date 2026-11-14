import { and, desc, eq } from 'drizzle-orm'
import { LABOUR_LIMITS } from '@citybus/domain'
import { defectReports, drivers, swapRequests, vehicles } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, errorText, format, getMessages } from '@/lib/i18n'
import { formatMinutes } from '@/lib/time'
import { reportDefectAction, requestSwapAction } from '../actions/drivers'

export const dynamic = 'force-dynamic'

export default async function DriverPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; requested?: string; defect?: string; error?: string }>
}) {
  const session = await requireSession(['driver'])
  const { m } = await getMessages()
  const params = await searchParams
  const errorMessage = errorText(m, params.error)
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))
  const db = getDb()

  if (session.driverId === null) {
    return (
      <>
        <h1>{m.driver.title}</h1>
        <div className="notice error">{m.errors.driverNotLinked}</div>
      </>
    )
  }

  const [driver] = await db.select().from(drivers).where(eq(drivers.id, session.driverId)).limit(1)
  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)
  const plateById = new Map(plan.snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.plate]))

  const myEntries = plan.snapshot.roster
    .filter((entry) => entry.driverId === session.driverId)
    .sort((a, b) => a.dayIndex - b.dayIndex)

  const myRequests = await db
    .select()
    .from(swapRequests)
    .where(and(eq(swapRequests.fromDriverId, session.driverId), eq(swapRequests.status, 'pending')))
    .orderBy(desc(swapRequests.createdAt))
    .limit(5)

  const myDefects = await db
    .select()
    .from(defectReports)
    .where(eq(defectReports.driverId, session.driverId))
    .orderBy(desc(defectReports.reportedAt))
    .limit(5)

  const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.organisationId, organisation.id))

  return (
    <>
      <h1>{m.driver.title}</h1>
      <p className="lead">
        <span>{driver?.fullName ?? m.common.driver}</span>
        <span className="badge">
          {m.driver.registerNo} {driver?.employeeNo ?? m.common.none}
        </span>
        <span className="badge">{format(m.plan.weekBadge, { week: weekStart })}</span>
        <span className="muted">
          {m.common.lastUpdate} {new Date().toISOString().slice(11, 16)} UTC
        </span>
      </p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}
      {params.requested !== undefined && <div className="notice">{m.driver.swapSent}</div>}
      {params.defect !== undefined && <div className="notice">{m.driver.defectSent}</div>}

      <form className="inline" action="/driver">
        <label>
          {m.common.week}
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit" className="secondary">
          {m.common.go}
        </button>
      </form>

      <h3>{m.driver.myDuties}</h3>
      {myEntries.length === 0 ? (
        <div className="notice">{m.driver.noDutiesThisWeek}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{m.common.day}</th>
              <th>{m.common.vehicle}</th>
              <th className="num">{m.common.start}</th>
              <th className="num">{m.common.end}</th>
              <th className="num">{m.common.rest}</th>
            </tr>
          </thead>
          <tbody>
            {myEntries.map((entry) => {
              const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
              return (
                <tr key={entry.dayIndex}>
                  <td>
                    {day === undefined ? entry.dayIndex : dayLabel(m, day.dayType)}{' '}
                    <span className="muted">{day?.date.slice(5)}</span>
                  </td>
                  <td>{plateById.get(entry.vehicleId) ?? m.common.none}</td>
                  <td className="num">{formatMinutes(entry.startMinute)}</td>
                  <td className="num">{formatMinutes(entry.endMinute)}</td>
                  <td className="num muted">
                    {entry.breakMinutes} {m.common.units.minutes}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="hint">
        {format(m.driver.labourHint, {
          rest: LABOUR_LIMITS.minRestBetweenDutiesMinutes / 60,
          driving: LABOUR_LIMITS.maxDrivingMinutes / 60,
        })}
      </p>

      {myEntries.length > 0 && (
        <>
          <h3>{m.driver.swapRequest}</h3>
          <form className="inline" action={requestSwapAction}>
            <input type="hidden" name="week" value={weekStart} />
            <label>
              {m.common.day}
              <select name="dayIndex" required defaultValue={String(myEntries[0]?.dayIndex ?? 1)}>
                {myEntries.map((entry) => {
                  const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
                  return (
                    <option key={entry.dayIndex} value={entry.dayIndex}>
                      {dayLabel(m, day?.dayType ?? 'monday')} {day?.date.slice(5)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label>
              {m.common.note}
              <input name="note" placeholder={m.driver.swapNotePlaceholder} maxLength={200} />
            </label>
            <button type="submit">{m.driver.swapSubmit}</button>
          </form>
          {myRequests.length > 0 && (
            <p className="hint">
              <span className="led warn" />
              {format(m.driver.swapPending, { count: myRequests.length })}
            </p>
          )}
        </>
      )}

      <h3>{m.driver.defect}</h3>
      <form className="inline" action={reportDefectAction}>
        <label>
          {m.driver.defectVehicle}
          <select name="plate" required defaultValue="">
            <option value="" disabled>
              {m.common.select}
            </option>
            {vehicleRows.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.plateNumber}>
                {vehicle.plateNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          {m.driver.defectSeverity}
          <select name="severity" defaultValue="medium">
            <option value="low">{m.driver.severityLow}</option>
            <option value="medium">{m.driver.severityMedium}</option>
            <option value="high">{m.driver.severityHigh}</option>
          </select>
        </label>
        <label>
          {m.driver.defectDescription}
          <input name="description" required maxLength={300} />
        </label>
        <button type="submit">{m.driver.defectSubmit}</button>
      </form>

      {myDefects.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{m.common.vehicle}</th>
              <th>{m.common.description}</th>
              <th>{m.common.status}</th>            </tr>
          </thead>
          <tbody>
            {myDefects.map((defect) => (
              <tr key={defect.id}>
                <td>{plateById.get(defect.vehicleId) ?? defect.vehicleId}</td>
                <td>{defect.description}</td>
                <td>
                  <span className="badge">{defect.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
