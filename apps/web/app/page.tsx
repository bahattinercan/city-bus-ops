import Link from 'next/link'
import { getOrganisation, getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function counts(organisationId: string) {
  const [row] = await getSql()<{
    vehicles: string
    routes: string
    stops: string
    trips: string
    drivers: string
    plans: string
  }[]>`
    select
      (select count(*) from vehicle where organisation_id = ${organisationId})::text as vehicles,
      (select count(*) from route where organisation_id = ${organisationId})::text as routes,
      (select count(*) from stop where organisation_id = ${organisationId})::text as stops,
      (select count(*) from trip t
        join route r on r.id = t.route_id
        where r.organisation_id = ${organisationId})::text as trips,
      (select count(*) from driver where organisation_id = ${organisationId})::text as drivers,
      (select count(*) from plan_version where organisation_id = ${organisationId})::text as plans
  `
  return {
    vehicles: Number(row?.vehicles ?? 0),
    routes: Number(row?.routes ?? 0),
    stops: Number(row?.stops ?? 0),
    trips: Number(row?.trips ?? 0),
    drivers: Number(row?.drivers ?? 0),
    plans: Number(row?.plans ?? 0),
  }
}

export default async function Home() {
  const organisation = await getOrganisation()
  const summary = await counts(organisation.id)

  return (
    <>
      <h1>Özet</h1>
      <p className="lead">
        {organisation.name} · rotasyon çapa haftası {organisation.rotationAnchorWeek} (7 haftalık döngü)
      </p>

      <div className="grid">
        <div className="card">
          <div className="value">{summary.vehicles}</div>
          <div className="label">Araç</div>
        </div>
        <div className="card">
          <div className="value">{summary.routes}</div>
          <div className="label">Hat</div>
        </div>
        <div className="card">
          <div className="value">{summary.stops}</div>
          <div className="label">Durak</div>
        </div>
        <div className="card">
          <div className="value">{summary.trips}</div>
          <div className="label">Sefer</div>
        </div>
        <div className="card">
          <div className="value">{summary.drivers}</div>
          <div className="label">Şoför</div>
        </div>
        <div className="card">
          <div className="value">{summary.plans}</div>
          <div className="label">Plan haftası</div>
        </div>
      </div>

      <h3>Sonraki adım</h3>
      {summary.trips === 0 ? (
        <div className="notice">
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
            <td>R1–R18 (13 sert / 5 yumuşak) + şoför çalışma kuralları L1–L5</td>
          </tr>
          <tr>
            <td>Rotasyon</td>
            <td>7 haftalık görev grubu gün kayması — resmî kural, ihlal onayı bloke eder</td>
          </tr>
          <tr>
            <td>Çıktılar</td>
            <td>
              <Link href="/api/gtfs">GTFS arşivi (zip)</Link> · haftalık plan ve Excel raporları
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
