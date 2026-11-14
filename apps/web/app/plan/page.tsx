import Link from 'next/link'
import { cellLabel } from '@citybus/domain'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { groupDayForWeek, loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, errorText, format, getMessages, ruleTitle, severityLabel, violationText } from '@/lib/i18n'
import { formatMinutes } from '@/lib/time'
import { isAssistantEnabled } from '@/lib/assistant'
import { generatePlanAction, publishPlanAction, setCellAction } from '../actions/plan'
import { EditPanel } from './edit-panel'

export const dynamic = 'force-dynamic'

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string
    error?: string
    notices?: string
    published?: string
    edited?: string
  }>
}) {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const { m } = await getMessages()
  const params = await searchParams
  const errorMessage = errorText(m, params.error)
  const noticesMessage = errorText(m, params.notices)
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))

  const plan = await loadPlan(getDb(), organisation.id, organisation.rotationAnchorWeek, weekStart)
  const { snapshot, version, violations } = plan

  const groupsById = new Map(snapshot.groups.map((group) => [group.id, group]))
  const routesById = new Map(snapshot.routes.map((route) => [route.id, route]))

  const cellByVehicleDay = new Map(
    snapshot.assignments.map((assignment) => [
      `${assignment.dayIndex}:${assignment.vehicleId}`,
      assignment,
    ]),
  )
  const standbyByVehicleDay = new Map(
    snapshot.standbys.map((standby) => [`${standby.dayIndex}:${standby.vehicleId}`, standby]),
  )

  const hardCount = violations.filter((violation) => violation.severity === 'hard').length
  const dutyPerDay = new Map<number, number>()
  for (const assignment of snapshot.assignments) {
    if (assignment.status !== 'duty') continue
    dutyPerDay.set(assignment.dayIndex, (dutyPerDay.get(assignment.dayIndex) ?? 0) + 1)
  }

  const stamp = new Date().toISOString().slice(11, 16)
  const status =
    version === null
      ? m.plan.statusNone
      : version.status === 'published'
        ? m.plan.statusPublished
        : m.plan.statusDraft

  return (
    <>
      <h1>{m.plan.title}</h1>
      <p className="lead">
        <span className="badge">{format(m.plan.weekBadge, { week: weekStart })}</span>
        <span className="badge">
          {format(m.plan.rotationBadge, { offset: snapshot.weekOffset })}
        </span>
        <span className={version?.status === 'published' ? 'badge ok' : 'badge'}>
          <span className={version?.status === 'published' ? 'led ok' : 'led warn'} />
          {status}
        </span>
        <span className="muted">
          {m.common.lastUpdate} {stamp} UTC
        </span>
      </p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}
      {params.published !== undefined && <div className="notice">{m.plan.publishedNotice}</div>}
      {params.edited !== undefined && (
        <div className="notice">{format(m.plan.editedNotice, { count: params.edited })}</div>
      )}
      {noticesMessage !== undefined && <div className="notice">{noticesMessage}</div>}

      <form className="inline" action="/plan">
        <label>
          {m.plan.weekLabel}
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit" className="secondary">
          {m.common.go}
        </button>
      </form>

      <div className="toolbar">
        <form action={generatePlanAction}>
          <input type="hidden" name="week" value={weekStart} />
          <button type="submit" className={version === null ? undefined : 'secondary'}>
            {version === null ? m.plan.generate : m.plan.regenerate}
          </button>
        </form>
        {version !== null && (
          <form action={publishPlanAction}>
            <input type="hidden" name="week" value={weekStart} />
            <button type="submit" className={hardCount > 0 ? 'secondary' : undefined}>
              {m.plan.publish}
            </button>
          </form>
        )}
        <Link href={`/api/plan/xlsx?week=${weekStart}`} className="button-link">
          {m.common.excel}
        </Link>
      </div>

      <h3>{m.plan.groups}</h3>
      <table>
        <thead>
          <tr>
            <th>{m.common.group}</th>
            <th className="num">{m.plan.groupVehicleCount}</th>
            <th>{m.common.day}</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.groups.map((group) => (
            <tr key={group.id}>
              <td>{group.name}</td>
              <td className="num">{group.vehicleCount}</td>
              <td>
                {dayLabel(m, dayTypeOf(groupDayForWeek(group.referenceDayIndex, snapshot.weekOffset)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {version === null ? (
        <div className="notice">{m.plan.noPlan}</div>
      ) : (
        <>
          <h3>{m.plan.matrix}</h3>
          <div className="scroll-x">
            <table className="matrix">
              <thead>
                <tr>
                  <th>{m.common.plate}</th>
                  {snapshot.days.map((day) => (
                    <th key={day.dayIndex}>
                      {dayLabel(m, day.dayType).slice(0, 3)}
                      <br />
                      <span className="muted">
                        {day.date.slice(5)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <strong>{vehicle.plate}</strong>
                    </td>
                    {snapshot.days.map((day) => {
                      const standby = standbyByVehicleDay.get(`${day.dayIndex}:${vehicle.id}`)
                      const cell = cellByVehicleDay.get(`${day.dayIndex}:${vehicle.id}`)
                      const label =
                        standby !== undefined
                          ? 'x'
                          : cell === undefined
                            ? ''
                            : cellLabel(cell, groupsById, routesById)
                      return (
                        <td
                          key={day.dayIndex}
                          className={label === 'YAT' ? 'muted' : undefined}
                          title={
                            cell?.firstTripMinute != null
                              ? format(m.plan.firstTripTitle, {
                                  time: formatMinutes(cell.firstTripMinute),
                                })
                              : undefined
                          }
                        >
                          {label}
                          {cell?.locked === true && (
                            <span className="badge soft" title={m.plan.lockedTitle} style={{ marginLeft: 4 }}>
                              {m.common.locked}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="muted">{m.plan.perDay}</td>
                  {snapshot.days.map((day) => (
                    <td key={day.dayIndex} className="num muted">
                      {dutyPerDay.get(day.dayIndex) ?? 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h3>
            {m.plan.ruleCheck} ·{' '}
            <span className={hardCount > 0 ? 'badge hard' : 'badge'}>
              {format(m.plan.hardCount, { count: hardCount })}
            </span>{' '}
            <span className="badge soft">
              {format(m.plan.softCount, { count: violations.length - hardCount })}
            </span>
          </h3>
          {violations.length === 0 ? (
            <div className="notice">{m.plan.noViolations}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{m.common.rule}</th>
                  <th>{m.severity.title}</th>
                  <th>{m.common.message}</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation, index) => (
                  <tr key={`${violation.code}-${index}`}>
                    <td>
                      <strong>{violation.code}</strong>
                      <br />
                      <span className="muted">{ruleTitle(m, violation.code) ?? m.plan.driverRule}</span>
                    </td>
                    <td>
                      <span className={`badge ${violation.severity}`}>
                        {severityLabel(m, violation.severity)}
                      </span>
                    </td>
                    <td>{violationText(m, violation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>{m.plan.bulkTitle}</h3>
          <EditPanel week={weekStart} assistantEnabled={isAssistantEnabled()} messages={m} />

          <h3>{m.plan.manualTitle}</h3>
          <form className="inline" action={setCellAction}>
            <input type="hidden" name="week" value={weekStart} />
            <label>
              {m.common.vehicle}
              <select name="plate" required defaultValue="">
                <option value="" disabled>
                  {m.common.select}
                </option>
                {snapshot.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plate}>
                    {vehicle.plate}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {m.common.day}
              <select name="dayIndex" required defaultValue="1">
                {snapshot.days.map((day) => (
                  <option key={day.dayIndex} value={day.dayIndex}>
                    {dayLabel(m, day.dayType)} {day.date.slice(5)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {m.common.code}
              <input name="code" placeholder={m.plan.codePlaceholder} required />
            </label>
            <button type="submit">{m.common.save}</button>
          </form>
          <p className="hint">{m.plan.cellHint}</p>
        </>
      )}

    </>
  )
}

function dayTypeOf(dayIndex: number): string {
  const map: Record<number, string> = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    7: 'sunday',
  }
  return map[dayIndex] ?? 'monday'
}
