import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { cyclePosition } from '@citybus/domain'
import { requireSession } from '@/lib/auth'
import { getOrganisation, allRows } from '@/lib/db'
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
  const organisation = await getOrganisation()
  const summary = await counts(organisation.id)
  const stamp = new Date().toISOString().slice(11, 16)

  const thisMonday = mondayOf(new Date().toISOString().slice(0, 10))
  const cycle = cyclePosition(weeksBetween(organisation.rotationAnchorWeek, thisMonday))

  return (
    <>
      <h1>Özet</h1>
      <p className="lead">
        <span>{organisation.name}</span>
        <span className="badge">çapa {organisation.rotationAnchorWeek}</span>
        <span className="badge">7 haftalık döngü</span>
        <span className="muted">son güncelleme {stamp} UTC</span>
      </p>

      <div className="split">
        <div className="grid">
          <div className="card">
            <div className="label">Araç</div>
            <div className="value">
              {summary.vehicles}
              <span className="unit">adet</span>
            </div>
          </div>
          <div className="card">
            <div className="label">Hat</div>
            <div className="value">
              {summary.routes}
              <span className="unit">adet</span>
            </div>
          </div>
          <div className="card">
            <div className="label">Durak</div>
            <div className="value">
              {summary.stops}
              <span className="unit">adet</span>
            </div>
          </div>
          <div className={summary.trips === 0 ? 'card warn' : 'card'}>
            <div className="label">Sefer</div>
            <div className="value">
              {summary.trips}
              <span className="unit">adet</span>
            </div>
            <div className="foot">
              <span className={summary.trips === 0 ? 'led warn' : 'led ok'} />
              {summary.trips === 0 ? 'tarife boş' : 'tarife hazır'}
            </div>
          </div>
          <div className="card">
            <div className="label">Şoför</div>
            <div className="value">
              {summary.drivers}
              <span className="unit">kişi</span>
            </div>
          </div>
          <div className="card">
            <div className="label">Plan haftası</div>
            <div className="value">
              {summary.plans}
              <span className="unit">hafta</span>
            </div>
          </div>
        </div>

        <section className="orbit-panel" aria-label="Rotasyon konumu">
          <div className="label">Rotasyon</div>
          <div className="orbit-field">
            <svg
              className="orbit"
              viewBox="0 0 120 120"
              role="img"
              aria-label={`7 haftalık döngüde ${cycle}. hafta`}
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
                HAFTA
              </text>
            </svg>
          </div>
          <div className="foot">
            <span className="led live" />
            bu hafta {thisMonday}
          </div>
        </section>
      </div>

      <h3>Sonraki adım</h3>
      {summary.trips === 0 ? (
        <div className="notice warn">
          Tarife boş. <Link href="/network">Ağ &amp; Tarife</Link> ekranından hat, durak ve sefer ekleyin;
          seferler olmadan haftalık plan üretilemez.
        </div>
      ) : (
        <div className="notice">
          Tarife hazır. <Link href="/plan">Haftalık Plan</Link> ekranından haftayı üretip kurallara göre
          doğrulayabilirsiniz.
        </div>
      )}

      <h3>Sistem</h3>
      <table>
        <tbody>
          <tr>
            <td>Kural kataloğu</td>
            <td className="muted">R1–R18 (13 sert / 5 yumuşak) + şoför çalışma kuralları L1–L5</td>
          </tr>
          <tr>
            <td>Rotasyon</td>
            <td className="muted">7 haftalık görev grubu gün kayması — resmî kural, ihlal onayı bloke eder</td>
          </tr>
          <tr>
            <td>Çıktılar</td>
            <td className="muted">
              <Link href="/api/gtfs">GTFS arşivi (zip)</Link> · haftalık plan ve Excel raporları
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
