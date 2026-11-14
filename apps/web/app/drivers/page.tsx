import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { LABOUR_LIMITS } from '@citybus/domain'
import { absences, defectReports, drivers, planVersions, swapRequests } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, formatMinutes } from '@/lib/time'
import {
  closeDefectAction,
  createDriverAction,
  decideSwapAction,
  generateRosterAction,
  markAbsenceAction,
} from '../actions/drivers'

export const dynamic = 'force-dynamic'

const SEVERITY_LABEL: Record<string, string> = { low: 'düşük', medium: 'orta', high: 'yüksek' }

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string; notices?: string; roster?: string }>
}) {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const params = await searchParams
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
      <h1>Şoförler</h1>
      <p className="lead">
        <span className="badge">{weekStart} haftası</span>
        <span className="badge">{driverRows.length} şoför</span>
        <span className="badge">{plan.snapshot.roster.length} atama</span>
        {pending.length > 0 && (
          <span className="badge soft">
            <span className="led warn" />
            {pending.length} bekleyen takas
          </span>
        )}
        <span className="muted">son güncelleme {stamp} UTC</span>
      </p>

      {params.error !== undefined && <div className="notice error">{params.error}</div>}
      {params.roster !== undefined && (
        <div className="notice">{params.roster} görev şoförlere dağıtıldı.</div>
      )}
      {params.notices !== undefined && <div className="notice error">{params.notices}</div>}

      <h3>Haftalık görevlendirme</h3>
      <div className="toolbar">
        <form action={generateRosterAction}>
          <input type="hidden" name="week" value={weekStart} />
          <button type="submit">Şoför ata (run cutting)</button>
        </form>
      </div>
      <p className="hint">
        Görev penceresi, hattın o günkü ilk kalkışından son varışına kadar hesaplanır (+
        {LABOUR_LIMITS.preparationMinutes} dk hazırlık, +{LABOUR_LIMITS.cleaningMinutes} dk temizlik). Mola, pencere içindeki
        boşluktur; L1–L5 kuralları bu değerlerle denetlenir.
      </p>

      {plan.snapshot.roster.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Gün</th>
              <th>Şoför</th>
              <th>Araç</th>
              <th className="num">Başlangıç</th>
              <th className="num">Bitiş</th>
              <th className="num">Sürüş</th>
              <th className="num">Mola</th>
            </tr>
          </thead>
          <tbody>
            {[...plan.snapshot.roster]
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((entry) => {
                const day = plan.snapshot.days.find((row) => row.dayIndex === entry.dayIndex)
                return (
                  <tr key={`${entry.dayIndex}-${entry.driverId}`}>
                    <td>{day === undefined ? entry.dayIndex : dayLabel(day.dayType)}</td>
                    <td>{driverById.get(entry.driverId)?.fullName ?? entry.driverId}</td>
                    <td>{vehiclePlate.get(entry.vehicleId) ?? '—'}</td>
                    <td className="num">{formatMinutes(entry.startMinute)}</td>
                    <td className="num">{formatMinutes(entry.endMinute)}</td>
                    <td className="num muted">{Math.round(entry.drivingMinutes / 60)} s</td>
                    <td className="num muted">{entry.breakMinutes} dk</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      )}

      <h3>Takas istekleri ({pending.length} bekleyen)</h3>
      {swaps.length === 0 ? (
        <div className="notice">Takas isteği yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hafta</th>
              <th>Gün</th>
              <th>Şoför</th>
              <th>Not</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {swaps.map((swap) => (
              <tr key={swap.id}>
                <td className="muted">{weekByVersion.get(swap.planVersionId) ?? '—'}</td>
                <td>{dayLabel((plan.snapshot.days.find((d) => d.dayIndex === swap.dayIndex)?.dayType ?? 'monday') as string)}</td>
                <td>{driverById.get(swap.fromDriverId)?.fullName ?? swap.fromDriverId}</td>
                <td className="muted">{swap.note ?? '—'}</td>
                <td>
                  <span className={`badge ${swap.status === 'pending' ? 'soft' : ''}`}>{swap.status}</span>
                </td>
                <td>
                  {swap.status === 'pending' && (
                    <div className="row-actions">
                      <form action={decideSwapAction}>
                        <input type="hidden" name="requestId" value={swap.id} />
                        <input type="hidden" name="decision" value="approved" />
                        <button type="submit">Onayla</button>
                      </form>
                      <form action={decideSwapAction}>
                        <input type="hidden" name="requestId" value={swap.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button type="submit" className="danger">
                          Reddet
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

      <h3>Arıza bildirimleri</h3>
      {defectRows.length === 0 ? (
        <div className="notice">Açık arıza bildirimi yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Araç</th>
              <th>Şiddet</th>
              <th>Açıklama</th>
              <th>Tarih</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {defectRows.map((defect) => (
              <tr key={defect.id}>
                <td>{vehiclePlate.get(defect.vehicleId) ?? defect.vehicleId}</td>
                <td>
                  <span className="badge hard">{SEVERITY_LABEL[defect.severity] ?? defect.severity}</span>
                </td>
                <td>{defect.description}</td>
                <td className="muted num">{defect.reportedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <form action={closeDefectAction}>
                    <input type="hidden" name="defectId" value={defect.id} />
                    <button type="submit" className="secondary">
                      Kapat
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Şoför ekle</h3>
      <form className="inline" action={createDriverAction}>
        <label>
          Sicil no
          <input name="employeeNo" required maxLength={20} />
        </label>
        <label>
          Ad soyad
          <input name="fullName" required />
        </label>
        <label>
          Ehliyet
          <input name="licenceClass" defaultValue="D" maxLength={4} />
        </label>
        <button type="submit">Ekle</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Sicil</th>
            <th>Ad</th>
            <th>Ehliyet</th>
            <th className="num">Bu hafta görev</th>
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

      <h3>İzin / rapor ekle</h3>
      <form className="inline" action={markAbsenceAction}>
        <label>
          Şoför
          <select name="driverId" required defaultValue="">
            <option value="" disabled>
              seç
            </option>
            {driverRows.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.employeeNo} — {driver.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Başlangıç
          <input type="date" name="dateFrom" required />
        </label>
        <label>
          Bitiş
          <input type="date" name="dateTo" />
        </label>
        <label>
          Tür
          <select name="type" defaultValue="leave">
            <option value="leave">izin</option>
            <option value="sick">rapor</option>
            <option value="other">diğer</option>
          </select>
        </label>
        <button type="submit">Kaydet</button>
      </form>

      {absenceRows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Şoför</th>
              <th>Tür</th>
              <th>Başlangıç</th>
              <th>Bitiş</th>
            </tr>
          </thead>
          <tbody>
            {absenceRows.map((row) => (
              <tr key={row.id}>
                <td>{row.driverId === null ? '—' : driverById.get(row.driverId)?.fullName ?? row.driverId}</td>
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
