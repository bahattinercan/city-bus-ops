import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { LABOUR_LIMITS } from '@citybus/domain'
import { absences, defectReports, drivers, planVersions, swapRequests } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, errorText, format, getMessages } from '@/lib/i18n'
import { formatMinutes } from '@/lib/time'
import {
  closeDefectAction,
  createDriverAction,
  decideSwapAction,
  generateRosterAction,
  markAbsenceAction,
} from '../actions/drivers'

export const dynamic = 'force-dynamic'


export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string; notices?: string; roster?: string }>
}) {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const { m } = await getMessages()
  const params = await searchParams
  const errorMessage = errorText(m, params.error)
  const noticesMessage = errorText(m, params.notices)
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)

  const [driverRows, absenceRows, defectRows] = await Promise.all([
    db.select().from(drivers).where(eq(drivers.organisationId, organisation.id)).orderBy(asc(drivers.fullName)),
    db.select().from(absences).where(eq(absences.organisationId, organisation.id)).orderBy(desc(absences.dateFrom)).limit(20),
    db
      .select()
      .from(defectReports)
      .where(and(eq(defectReports.organisationId, organisation.id), eq(defectReports.status, 'open')))
      .orderBy(desc(defectReports.reportedAt))
      .limit(20),
  ])

  const driverById = new Map(driverRows.map((driver) => [driver.id, driver]))
  const vehiclePlate = new Map(plan.snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.plate]))

  const recentVersions = await db
    .select({ id: planVersions.id, weekStart: planVersions.weekStart })
    .from(planVersions)
    .where(eq(planVersions.organisationId, organisation.id))
    .orderBy(desc(planVersions.weekStart))
    .limit(4)

  const swaps =
    recentVersions.length === 0
      ? []
      : await db
          .select()
          .from(swapRequests)
          .where(inArray(swapRequests.planVersionId, recentVersions.map((row) => row.id)))
          .orderBy(desc(swapRequests.createdAt))
          .limit(20)

  const weekByVersion = new Map(recentVersions.map((row) => [row.id, row.weekStart]))
  const pending = swaps.filter((swap) => swap.status === 'pending')

  const load = new Map<string, number>()
  for (const entry of plan.snapshot.roster) {
    load.set(entry.driverId, (load.get(entry.driverId) ?? 0) + 1)
  }

  const stamp = new Date().toISOString().slice(11, 16)

  return (
    <>
      <h1>{m.drivers.title}</h1>
      <p className="lead">
        <span className="badge">{format(m.plan.weekBadge, { week: weekStart })}</span>
        <span className="badge">{format(m.drivers.driverCount, { count: driverRows.length })}</span>
        <span className="badge">
          {format(m.drivers.assignmentCount, { count: plan.snapshot.roster.length })}
        </span>
        {pending.length > 0 && (
          <span className="badge soft">
            <span className="led warn" />
            {format(m.drivers.pendingSwaps, { count: pending.length })}
          </span>
        )}
        <span className="muted">
          {m.common.lastUpdate} {stamp} UTC
        </span>
      </p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}
      {params.roster !== undefined && (
        <div className="notice">{format(m.drivers.rosterNotice, { count: params.roster })}</div>
      )}
      {noticesMessage !== undefined && <div className="notice error">{noticesMessage}</div>}

      <h3>{m.drivers.weekly}</h3>
      <div className="toolbar">
        <form action={generateRosterAction}>
          <input type="hidden" name="week" value={weekStart} />
          <button type="submit">{m.drivers.runCutting}</button>
        </form>
      </div>
      <p className="hint">
        {format(m.drivers.cuttingHint, {
          prep: LABOUR_LIMITS.preparationMinutes,
          clean: LABOUR_LIMITS.cleaningMinutes,
        })}
      </p>

      {plan.snapshot.roster.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{m.common.day}</th>
              <th>{m.common.driver}</th>
              <th>{m.common.vehicle}</th>
              <th className="num">{m.common.start}</th>
              <th className="num">{m.common.end}</th>
              <th className="num">{m.common.driving}</th>
              <th className="num">{m.common.rest}</th>
            </tr>
          </thead>
          <tbody>
            {[...plan.snapshot.roster]
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((entry) => {
                const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
                return (
                  <tr key={`${entry.dayIndex}-${entry.driverId}`}>
                    <td>{day === undefined ? entry.dayIndex : dayLabel(m, day.dayType)}</td>
                    <td>{driverById.get(entry.driverId)?.fullName ?? entry.driverId}</td>
                    <td>{vehiclePlate.get(entry.vehicleId) ?? m.common.none}</td>
                    <td className="num">{formatMinutes(entry.startMinute)}</td>
                    <td className="num">{formatMinutes(entry.endMinute)}</td>
                    <td className="num muted">
                      {Math.round(entry.drivingMinutes / 60)} h
                    </td>
                    <td className="num muted">
                      {entry.breakMinutes} {m.common.units.minutes}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      )}

      <h3>{m.driver.swapRequest}</h3>
      {swaps.length === 0 ? (
        <div className="notice">{m.drivers.noSwaps}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{m.common.week}</th>
              <th>{m.common.day}</th>
              <th>{m.common.driver}</th>
              <th>{m.drivers.swapNote}</th>
              <th>{m.common.status}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {swaps.map((swap) => (
              <tr key={swap.id}>
                <td className="muted">{weekByVersion.get(swap.planVersionId) ?? m.common.none}</td>
                <td>
                  {dayLabel(
                    m,
                    (plan.snapshot.days.find((d) => d.dayIndex === swap.dayIndex)?.dayType ??
                      'monday') as string,
                  )}
                </td>
                <td>{driverById.get(swap.fromDriverId)?.fullName ?? swap.fromDriverId}</td>
                <td className="muted">{swap.note ?? m.common.none}</td>
                <td>
                  <span className={`badge ${swap.status === 'pending' ? 'soft' : ''}`}>{swap.status}</span>
                </td>
                <td>
                  {swap.status === 'pending' && (
                    <div className="row-actions">
                      <form action={decideSwapAction}>
                        <input type="hidden" name="requestId" value={swap.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <button type="submit">{m.drivers.approve}</button>
                      </form>
                      <form action={decideSwapAction}>
                        <input type="hidden" name="requestId" value={swap.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button type="submit" className="danger">
                          {m.drivers.reject}
                        </button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{m.drivers.defects}</h3>
      {defectRows.length === 0 ? (
        <div className="notice">{m.drivers.noDefects}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{m.common.vehicle}</th>
              <th>{m.severity.title}</th>
              <th>{m.common.description}</th>
              <th>{m.common.date}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {defectRows.map((defect) => (
              <tr key={defect.id}>
                <td>{vehiclePlate.get(defect.vehicleId) ?? defect.vehicleId}</td>
                <td>
                  <span className="badge hard">
                    {defect.severity === 'low'
                      ? m.drivers.severityLow
                      : defect.severity === 'high'
                        ? m.drivers.severityHigh
                        : m.drivers.severityMedium}
                  </span>
                </td>
                <td>{defect.description}</td>
                <td className="muted num">{defect.reportedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <form action={closeDefectAction}>
                    <input type="hidden" name="defectId" value={defect.id} />
                    <button type="submit" className="secondary">
                      {m.drivers.close}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>{m.drivers.addDriver}</h3>
      <form className="inline" action={createDriverAction}>
        <label>
          {m.drivers.registerNo}
          <input name="employeeNo" required maxLength={20} />
        </label>
        <label>
          {m.drivers.fullName}
          <input name="fullName" required />
        </label>
        <label>
          {m.drivers.licence}
          <input name="licenceClass" defaultValue="D" maxLength={4} />
        </label>
        <button type="submit">{m.common.add}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>{m.drivers.registerNo}</th>
            <th>{m.common.name}</th>
            <th>{m.drivers.licence}</th>
            <th className="num">{m.drivers.dutiesThisWeek}</th>
          </tr>
        </thead>
        <tbody>
          {driverRows.map((driver) => (
            <tr key={driver.id}>
              <td className="muted">{driver.employeeNo}</td>
              <td>{driver.fullName}</td>
              <td className="muted">{driver.licenceClass}</td>
              <td className="num">{load.get(driver.id) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{m.drivers.addAbsence}</h3>
      <form className="inline" action={markAbsenceAction}>
        <label>
          {m.common.driver}
          <select name="driverId" required defaultValue="">
            <option value="" disabled>
              {m.common.select}
            </option>
            {driverRows.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.employeeNo} — {driver.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          {m.common.start}
          <input type="date" name="dateFrom" required />
        </label>
        <label>
          {m.common.end}
          <input type="date" name="dateTo" />
        </label>
        <label>
          {m.common.status}
          <select name="type" defaultValue="leave">
            <option value="leave">{m.drivers.absenceLeave}</option>
            <option value="sick">{m.drivers.absenceSick}</option>
            <option value="other">{m.drivers.absenceOther}</option>
          </select>
        </label>
        <button type="submit">{m.common.save}</button>
      </form>

      {absenceRows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{m.common.driver}</th>
              <th>{m.common.status}</th>
              <th>{m.common.start}</th>
              <th>{m.common.end}</th>
            </tr>
          </thead>
          <tbody>
            {absenceRows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.driverId === null
                    ? m.common.none
                    : (driverById.get(row.driverId)?.fullName ?? row.driverId)}
                </td>
                <td>{row.type}</td>
                <td>{row.dateFrom}</td>
                <td>{row.dateTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
