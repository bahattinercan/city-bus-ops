import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { routes, stops } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { allRows, getDb, getOrganisation } from '@/lib/db'
import { errorText, format, getMessages } from '@/lib/i18n'
import { createRouteAction, createStopAction } from '../actions/network'

export const dynamic = 'force-dynamic'

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireSession(['admin', 'planner'])
  const { m } = await getMessages()
  const { error } = await searchParams
  const errorMessage = errorText(m, error)
  const organisation = await getOrganisation()
  const db = getDb()

  const routeRows = await db
    .select()
    .from(routes)
    .where(eq(routes.organisationId, organisation.id))
    .orderBy(asc(routes.code))

  const stopRows = await db
    .select()
    .from(stops)
    .where(eq(stops.organisationId, organisation.id))
    .orderBy(asc(stops.code))

  const stats = allRows<{ route_id: string; stop_count: number; trip_count: number }>(sql`
    select r.id as route_id,
           (select count(*) from route_stop rs where rs.route_id = r.id) as stop_count,
           (select count(*) from trip t where t.route_id = r.id) as trip_count
    from route r
    where r.organisation_id = ${organisation.id}
  `)
  const statsByRoute = new Map(stats.map((row) => [row.route_id, row]))

  const stamp = new Date().toISOString().slice(11, 16)

  return (
    <>
      <h1>{m.network.title}</h1>
      <p className="lead">
        <span>{m.network.lead}</span>
        <span className="badge">{format(m.network.routeCount, { count: routeRows.length })}</span>
        <span className="badge">{format(m.network.stopCount, { count: stopRows.length })}</span>
        <span className="muted">
          {m.network.exportReady}
          {"·"} {m.common.lastUpdate} {stamp} UTC
        </span>
      </p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}

      <h3>{m.network.addRoute}</h3>
      <form className="inline" action={createRouteAction}>
        <label>
          {m.network.routeCode}
          <input name="code" placeholder={m.network.routeCodePlaceholder} required maxLength={6} />
        </label>
        <label>
          {m.common.name}
          <input name="name" placeholder={m.network.namePlaceholderEmptyUsesCode} />
        </label>
        <label>
          <span>{m.network.requireLowFloor}</span>
          <input type="checkbox" name="requiredLowFloor" />
        </label>
        <label>
          <span>{m.network.requireAc}</span>
          <input type="checkbox" name="requiredAc" />
        </label>
        <button type="submit">{m.common.add}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>{m.common.code}</th>
            <th>{m.common.name}</th>
            <th className="num">{m.home.cards.stops}</th>
            <th className="num">{m.home.cards.trips}</th>
            <th>{m.common.requirement}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {routeRows.map((route) => {
            const stat = statsByRoute.get(route.id)
            return (
              <tr key={route.id}>
                <td>
                  <strong>{route.code}</strong>
                </td>
                <td>{route.name}</td>
                <td className="num">{stat?.stop_count ?? '0'}</td>
                <td className="num">{stat?.trip_count ?? '0'}</td>
                <td>
                  {[route.requiredLowFloor ? m.network.requirementLowFloor : null, route.requiredAc ? m.network.requirementAc : null]
                    .filter(Boolean)
                    .map((requirement) => (
                      <span key={requirement} className="badge" style={{ marginRight: 4 }}>
                        {requirement}
                      </span>
                    ))}
                  {!route.requiredLowFloor && !route.requiredAc && <span className="muted">—</span>}
                </td>
                <td>
                  <Link href={`/network/${encodeURIComponent(route.code)}`}>{m.common.open}</Link>
                </td>
              </tr>
            )
          })}
          {routeRows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                {m.network.noRoutes}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>{m.network.addStop}</h3>
      <form className="inline" action={createStopAction}>
        <label>
          {m.network.stopCode}
          <input name="code" placeholder="S001" required maxLength={20} />
        </label>
        <label>
          Ad
          <input name="name" placeholder={m.network.stopNamePlaceholder} required />
        </label>
        <label>
          {m.network.latitude}
          <input name="latitude" placeholder="39.42" inputMode="decimal" />
        </label>
        <label>
          {m.network.longitude}
          <input name="longitude" placeholder="29.98" inputMode="decimal" />
        </label>
        <button type="submit">Ekle</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Kod</th>
            <th>Ad</th>
            <th>{m.common.location}</th>
          </tr>
        </thead>
        <tbody>
          {stopRows.map((stop) => (
            <tr key={stop.id}>
              <td>
                <strong>{stop.code}</strong>
              </td>
              <td>{stop.name}</td>
              <td className="muted">
                {stop.latitude !== null && stop.longitude !== null
                  ? `${stop.latitude}, ${stop.longitude}`
                  : '—'}
              </td>
            </tr>
          ))}
          {stopRows.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                {m.network.noStops}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
