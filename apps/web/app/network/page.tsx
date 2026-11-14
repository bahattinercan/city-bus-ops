import Link from 'next/link'
import { asc, eq, sql } from 'drizzle-orm'
import { routes, stops } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { allRows, getDb, getOrganisation } from '@/lib/db'
import { createRouteAction, createStopAction } from '../actions/network'

export const dynamic = 'force-dynamic'

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireSession(['admin', 'planner'])
  const { error } = await searchParams
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
      <h1>Ağ &amp; Tarife</h1>
      <p className="lead">
        <span>hatlar, duraklar ve seferler</span>
        <span className="badge">{routeRows.length} hat</span>
        <span className="badge">{stopRows.length} durak</span>
        <span className="muted">GTFS dışa aktarımı hazır · son güncelleme {stamp} UTC</span>
      </p>

      {error !== undefined && <div className="notice error">{error}</div>}

      <h3>Hat ekle</h3>
      <form className="inline" action={createRouteAction}>
        <label>
          Hat kodu
          <input name="code" placeholder="9AT" required maxLength={6} />
        </label>
        <label>
          Ad
          <input name="name" placeholder="(boşsa kod kullanılır)" />
        </label>
        <label>
          <span>Engelli erişimi</span>
          <input type="checkbox" name="requiredLowFloor" />
        </label>
        <label>
          <span>Klima</span>
          <input type="checkbox" name="requiredAc" />
        </label>
        <button type="submit">Ekle</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Kod</th>
            <th>Ad</th>
            <th className="num">Durak</th>
            <th className="num">Sefer</th>
            <th>Gereksinim</th>
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
                  {[route.requiredLowFloor ? 'engelli' : null, route.requiredAc ? 'klima' : null]
                    .filter(Boolean)
                    .map((requirement) => (
                      <span key={requirement} className="badge" style={{ marginRight: 4 }}>
                        {requirement}
                      </span>
                    ))}
                  {!route.requiredLowFloor && !route.requiredAc && <span className="muted">—</span>}
                </td>
                <td>
                  <Link href={`/network/${encodeURIComponent(route.code)}`}>Aç</Link>
                </td>
              </tr>
            )
          })}
          {routeRows.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                Kayıtlı hat yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Durak ekle</h3>
      <form className="inline" action={createStopAction}>
        <label>
          Durak kodu
          <input name="code" placeholder="S001" required maxLength={20} />
        </label>
        <label>
          Ad
          <input name="name" placeholder="Otogar" required />
        </label>
        <label>
          Enlem
          <input name="latitude" placeholder="39.42" inputMode="decimal" />
        </label>
        <label>
          Boylam
          <input name="longitude" placeholder="29.98" inputMode="decimal" />
        </label>
        <button type="submit">Ekle</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Kod</th>
            <th>Ad</th>
            <th>Konum</th>
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
                Kayıtlı durak yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
