import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { DAY_TYPES } from '@citybus/domain'
import { routeStops, routes, stops, trips } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { dayLabel, errorText, format, getMessages } from '@/lib/i18n'
import { formatMinutes, formatMinutesLong } from '@/lib/time'
import {
  addRouteStopAction,
  createTripAction,
  deleteTripAction,
  removeRouteStopAction,
} from '../../actions/network'

export const dynamic = 'force-dynamic'

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireSession(['admin', 'planner'])
  const { m } = await getMessages()
  const { code } = await params
  const { error } = await searchParams
  const errorMessage = errorText(m, error)
  const routeCode = decodeURIComponent(code)
  const organisation = await getOrganisation()
  const db = getDb()

  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organisationId, organisation.id), eq(routes.code, routeCode)))
    .limit(1)

  if (route === undefined) {
    notFound()
  }

  const routeStopRows = await db
    .select({ sequence: routeStops.sequence, code: stops.code, name: stops.name })
    .from(routeStops)
    .innerJoin(stops, eq(stops.id, routeStops.stopId))
    .where(eq(routeStops.routeId, route.id))
    .orderBy(asc(routeStops.sequence))

  const allStops = await db
    .select({ code: stops.code, name: stops.name })
    .from(stops)
    .where(eq(stops.organisationId, organisation.id))
    .orderBy(asc(stops.code))

  const tripRows = await db
    .select()
    .from(trips)
    .where(eq(trips.routeId, route.id))
    .orderBy(asc(trips.dayType), asc(trips.startMinute))

  const grouped = DAY_TYPES.map((dayType) => ({
    dayType,
    trips: tripRows.filter((trip) => trip.dayType === dayType),
  })).filter((group) => group.trips.length > 0)

  return (
    <>
      <h1>
        {format(m.route.title, { code: route.code })}{" "}
        <span className="muted">{"·"} {route.name}</span>
      </h1>
      <p className="lead">
        <Link href="/network">{m.route.back}</Link>
        <span className="badge">{format(m.route.stopCount, { count: routeStopRows.length })}</span>
        <span className="badge">{format(m.route.tripCount, { count: tripRows.length })}</span>
        <span className="muted">
          {m.common.lastUpdate} {new Date().toISOString().slice(11, 16)} UTC
        </span>
      </p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}

      <h3>{format(m.route.stops, { count: routeStopRows.length })}</h3>
      {routeStopRows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th className="num">{m.common.order}</th>
              <th>{m.common.code}</th>
              <th>{m.common.name}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {routeStopRows.map((stop) => (
              <tr key={stop.sequence}>
                <td className="num">{stop.sequence}</td>
                <td>
                  <strong>{stop.code}</strong>
                </td>
                <td>{stop.name}</td>
                <td>
                  <form action={removeRouteStopAction}>
                    <input type="hidden" name="routeCode" value={route.code} />
                    <input type="hidden" name="sequence" value={stop.sequence} />
                    <button type="submit" className="danger">
                      {m.common.remove}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="notice">{m.route.noStopsYet}</div>
      )}

      <h3>{m.route.addStop}</h3>
      <form className="inline" action={addRouteStopAction}>
        <input type="hidden" name="routeCode" value={route.code} />
        <label>
          {m.home.cards.stops}
          <select name="stopCode" required defaultValue="">
            <option value="" disabled>
              {m.common.select}
            </option>
            {allStops.map((stop) => (
              <option key={stop.code} value={stop.code}>
                {stop.code} — {stop.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{m.route.appendToEnd}</button>
      </form>

      <h3>{m.route.addTrip}</h3>
      <form className="inline" action={createTripAction}>
        <input type="hidden" name="routeCode" value={route.code} />
        <label>
          {m.common.day}
          <select name="dayType" required defaultValue="monday">
            {DAY_TYPES.map((dayType) => (
              <option key={dayType} value={dayType}>
                {dayLabel(m, dayType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {m.common.start}
          <input name="start" placeholder={m.route.tripStartPattern} required pattern="\d{1,2}[:.]\d{2}" />
        </label>
        <label>
          {m.common.end}
          <input name="end" placeholder={m.route.tripEndPattern} required pattern="\d{1,2}[:.]\d{2}" />
        </label>
        <button type="submit">{m.common.add}</button>
      </form>
      <p className="hint">
        {m.route.stopSpreadHint}
      </p>

      {grouped.map((group) => (
        <div key={group.dayType}>
          <h3>{dayLabel(m, group.dayType)}</h3>
          <table>
            <thead>
              <tr>
                <th className="num">{m.common.departure}</th>
                <th className="num">{m.common.arrival}</th>
                <th className="num">{m.common.duration}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {group.trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="num">{formatMinutes(trip.startMinute)}</td>
                  <td className="num">
                    {formatMinutesLong(trip.endMinute)}
                    {trip.crossesMidnight && (
                      <span className="badge" style={{ marginLeft: 4 }}>
                        {m.common.night}
                      </span>
                    )}
                  </td>
                  <td className="num muted">
                    {trip.endMinute - trip.startMinute} {m.common.units.minutes}
                  </td>
                  <td>
                    <form action={deleteTripAction}>
                      <input type="hidden" name="routeCode" value={route.code} />
                      <input type="hidden" name="tripId" value={trip.id} />
                      <button type="submit" className="danger">
                        {m.common.delete}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {grouped.length === 0 && <div className="notice">{m.route.noTrips}</div>}
    </>
  )
}
