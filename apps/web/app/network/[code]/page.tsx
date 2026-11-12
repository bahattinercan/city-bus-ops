import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { DAY_TYPES } from '@citybus/domain'
import { routeStops, routes, stops, trips } from '@citybus/db'
import { getDb, getOrganisation } from '@/lib/db'
import { dayLabel, formatMinutes, formatMinutesLong } from '@/lib/time'
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
  const { code } = await params
  const { error } = await searchParams
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
        Hat {route.code} <span className="muted">· {route.name}</span>
      </h1>
      <p className="lead">
        <Link href="/network">← Ağ &amp; Tarife</Link>
      </p>

      {error !== undefined && <div className="notice error">{error}</div>}

      <h3>Duraklar ({routeStopRows.length})</h3>
      {routeStopRows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Kod</th>
              <th>Ad</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {routeStopRows.map((stop) => (
              <tr key={stop.sequence}>
                <td>{stop.sequence}</td>
                <td>
                  <strong>{stop.code}</strong>
                </td>
                <td>{stop.name}</td>
                <td>
                  <form action={removeRouteStopAction}>
                    <input type="hidden" name="routeCode" value={route.code} />
                    <input type="hidden" name="sequence" value={stop.sequence} />
                    <button type="submit" className="danger">
                      Çıkar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="notice">Henüz durak yok. Sefer ekleyebilmek için en az iki durak gerekir.</div>
      )}

      <h3>Durak ekle</h3>
      <form className="inline" action={addRouteStopAction}>
        <input type="hidden" name="routeCode" value={route.code} />
        <label>
          Durak
          <select name="stopCode" required defaultValue="">
            <option value="" disabled>
              seç
            </option>
            {allStops.map((stop) => (
              <option key={stop.code} value={stop.code}>
                {stop.code} — {stop.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Sonuna ekle</button>
      </form>

      <h3>Sefer ekle</h3>
      <form className="inline" action={createTripAction}>
        <input type="hidden" name="routeCode" value={route.code} />
        <label>
          Gün
          <select name="dayType" required defaultValue="monday">
            {DAY_TYPES.map((dayType) => (
              <option key={dayType} value={dayType}>
                {dayLabel(dayType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Başlangıç
          <input name="start" placeholder="06:00" required pattern="\d{1,2}[:.]\d{2}" />
        </label>
        <label>
          Bitiş
          <input name="end" placeholder="06:40" required pattern="\d{1,2}[:.]\d{2}" />
        </label>
        <button type="submit">Ekle</button>
      </form>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: '-0.4rem' }}>
        Durak saatleri iki uç arasında eşit dağıtılır; tek tek düzeltme sonraki adımda gelecek.
      </p>

      {grouped.map((group) => (
        <div key={group.dayType}>
          <h3>{dayLabel(group.dayType)}</h3>
          <table>
            <thead>
              <tr>
                <th>Kalkış</th>
                <th>Varış</th>
                <th>Süre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {group.trips.map((trip) => (
                <tr key={trip.id}>
                  <td>{formatMinutes(trip.startMinute)}</td>
                  <td>
                    {formatMinutesLong(trip.endMinute)}
                    {trip.crossesMidnight && <span className="badge">gece</span>}
                  </td>
                  <td className="muted">{trip.endMinute - trip.startMinute} dk</td>
                  <td>
                    <form action={deleteTripAction}>
                      <input type="hidden" name="routeCode" value={route.code} />
                      <input type="hidden" name="tripId" value={trip.id} />
                      <button type="submit" className="danger">
                        Sil
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {grouped.length === 0 && <div className="notice">Bu hatta henüz sefer tanımlı değil.</div>}
    </>
  )
}
