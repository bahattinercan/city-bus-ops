import { and, desc, eq } from 'drizzle-orm'
import { LABOUR_LIMITS } from '@citybus/domain'
import { defectReports, drivers, swapRequests, vehicles } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, formatMinutes } from '@/lib/time'
import { reportDefectAction, requestSwapAction } from '../actions/drivers'

export const dynamic = 'force-dynamic'

export default async function DriverPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; requested?: string; defect?: string; error?: string }>
}) {
  const session = await requireSession(['driver'])
  const params = await searchParams
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))
  const db = getDb()

  if (session.driverId === null) {
    return (
      <>
        <h1>Benim Haftam</h1>
        <div className="notice error">Bu hesap bir şoför kaydına bağlı değil. Yöneticiye başvurun.</div>
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
      <h1>Benim Haftam</h1>
      <p className="lead">
        <span>{driver?.fullName ?? 'Şoför'}</span>
        <span className="badge">sicil {driver?.employeeNo ?? '—'}</span>
        <span className="badge">{weekStart} haftası</span>
        <span className="muted">son güncelleme {new Date().toISOString().slice(11, 16)} UTC</span>
      </p>

      {params.error !== undefined && <div className="notice error">{params.error}</div>}
      {params.requested !== undefined && <div className="notice">Takas isteğiniz santrale gönderildi.</div>}
      {params.defect !== undefined && <div className="notice">Arıza bildirimi kaydedildi.</div>}

      <form className="inline" action="/driver">
        <label>
          Hafta
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit" className="secondary">
          Git
        </button>
      </form>

      <h3>Görevlerim</h3>
      {myEntries.length === 0 ? (
        <div className="notice">Bu hafta atanmış göreviniz yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Gün</th>
              <th>Araç</th>
              <th className="num">Başlangıç</th>
              <th className="num">Bitiş</th>
              <th className="num">Mola</th>
            </tr>
          </thead>
          <tbody>
            {myEntries.map((entry) => {
              const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
              return (
                <tr key={entry.dayIndex}>
                  <td>
                    {day === undefined ? entry.dayIndex : dayLabel(day.dayType)}{' '}
                    <span className="muted">{day?.date.slice(5)}</span>
                  </td>
                  <td>{plateById.get(entry.vehicleId) ?? '—'}</td>
                  <td className="num">{formatMinutes(entry.startMinute)}</td>
                  <td className="num">{formatMinutes(entry.endMinute)}</td>
                  <td className="num muted">{entry.breakMinutes} dk</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="hint">
        Görev penceresi: en az {LABOUR_LIMITS.minRestBetweenDutiesMinutes / 60} saat iki görev arası dinlenme, en fazla{' '}
        {LABOUR_LIMITS.maxDrivingMinutes / 60} saat sürüş.
      </p>

      {myEntries.length > 0 && (
        <>
          <h3>Takas isteği</h3>
          <form className="inline" action={requestSwapAction}>
            <input type="hidden" name="week" value={weekStart} />
            <label>
              Gün
              <select name="dayIndex" required defaultValue={String(myEntries[0]?.dayIndex ?? 1)}>
                {myEntries.map((entry) => {
                  const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
                  return (
                    <option key={entry.dayIndex} value={entry.dayIndex}>
                      {dayLabel(day?.dayType ?? 'monday')} {day?.date.slice(5)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label>
              Not
              <input name="note" placeholder="neden?" maxLength={200} />
            </label>
            <button type="submit">Santralden izin iste</button>
          </form>
          {myRequests.length > 0 && (
            <p className="hint">
              <span className="led warn" />
              Bekleyen istek: {myRequests.length}
            </p>
          )}
        </>
      )}

      <h3>Arıza bildir</h3>
      <form className="inline" action={reportDefectAction}>
        <label>
          Araç
          <select name="plate" required defaultValue="">
            <option value="" disabled>
              seç
            </option>
            {vehicleRows.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.plateNumber}>
                {vehicle.plateNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          Şiddet
          <select name="severity" defaultValue="medium">
            <option value="low">düşük</option>
            <option value="medium">orta</option>
            <option value="high">yüksek</option>
          </select>
        </label>
        <label>
          Açıklama
          <input name="description" required maxLength={300} />
        </label>
        <button type="submit">Bildir</button>
      </form>

      {myDefects.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Araç</th>
              <th>Açıklama</th>
              <th>Durum</th>            </tr>
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
