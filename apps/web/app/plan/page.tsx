import Link from 'next/link'
import { RULE_CATALOG, cellLabel, type RuleCode } from '@citybus/domain'
import { getDb, getOrganisation } from '@/lib/db'
import { groupDayForWeek, loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel, formatMinutes } from '@/lib/time'
import { generatePlanAction, publishPlanAction, setCellAction } from '../actions/plan'

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
  const params = await searchParams
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))

  const plan = await loadPlan(getDb(), organisation.id, organisation.rotationAnchorWeek, weekStart)
  const { snapshot, version, violations } = plan

  const groupsById = new Map(snapshot.groups.map((group) => [group.id, group]))
  const routesById = new Map(snapshot.routes.map((route) => [route.id, route]))
  const plateById = new Map(snapshot.vehicles.map((vehicle) => [vehicle.id, vehicle.plate]))

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

  return (
    <>
      <h1>Haftalık Plan</h1>
      <p className="lead">
        {weekStart} haftası · rotasyon konumu {snapshot.weekOffset} (7 haftalık döngü) ·{' '}
        {version === null ? 'plan yok' : version.status === 'published' ? 'yayınlandı' : 'taslak'}
      </p>

      {params.error !== undefined && <div className="notice error">{params.error}</div>}
      {params.published !== undefined && <div className="notice">Plan yayınlandı.</div>}
      {params.edited !== undefined && <div className="notice">{params.edited} hücresi elle düzenlendi ve kilitlendi.</div>}
      {params.notices !== undefined && <div className="notice">{params.notices}</div>}

      <form className="inline" action="/plan">
        <label>
          Hafta (herhangi bir gün)
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit" className="secondary">
          Git
        </button>
      </form>

      <div className="row-actions" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <form action={generatePlanAction}>
          <input type="hidden" name="week" value={weekStart} />
          <button type="submit">{version === null ? 'Haftayı üret' : 'Yeniden üret'}</button>
        </form>
        {version !== null && (
          <form action={publishPlanAction}>
            <input type="hidden" name="week" value={weekStart} />
            <button type="submit" className={hardCount > 0 ? 'secondary' : undefined}>
              Yayınla
            </button>
          </form>
        )}
        <Link href={`/api/plan/xlsx?week=${weekStart}`} className="muted" style={{ alignSelf: 'center' }}>
          Excel indir
        </Link>
      </div>

      <h3>Görev grupları bu hafta</h3>
      <table>
        <thead>
          <tr>
            <th>Grup</th>
            <th>Araç sayısı</th>
            <th>Gün</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.groups.map((group) => (
            <tr key={group.id}>
              <td>{group.name}</td>
              <td>{group.vehicleCount}</td>
              <td>{dayLabel(dayTypeOf(groupDayForWeek(group.referenceDayIndex, snapshot.weekOffset)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {version === null ? (
        <div className="notice">Bu hafta için plan yok. &quot;Haftayı üret&quot; ile başlayın.</div>
      ) : (
        <>
          <h3>Plan tablosu</h3>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Plaka</th>
                  {snapshot.days.map((day) => (
                    <th key={day.dayIndex}>
                      {dayLabel(day.dayType).slice(0, 3)}
                      <br />
                      <span className="muted" style={{ fontWeight: 400 }}>
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
                            cell?.firstTripMinute != null ? `ilk sefer ${formatMinutes(cell.firstTripMinute)}` : undefined
                          }
                        >
                          {label}
                          {cell?.locked === true && <span title="elle kilitli">🔒</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="muted">/gün</td>
                  {snapshot.days.map((day) => (
                    <td key={day.dayIndex} className="muted">
                      {dutyPerDay.get(day.dayIndex) ?? 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h3>
            Kural denetimi ·{' '}
            <span className={hardCount > 0 ? 'badge hard' : 'badge'}>{hardCount} sert</span>{' '}
            <span className="badge soft">{violations.length - hardCount} yumuşak</span>
          </h3>
          {violations.length === 0 ? (
            <div className="notice">Kural ihlali yok.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Kural</th>
                  <th>Şiddet</th>
                  <th>Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation, index) => (
                  <tr key={`${violation.code}-${index}`}>
                    <td>
                      <strong>{violation.code}</strong>
                      <br />
                      <span className="muted" style={{ fontSize: '0.78rem' }}>
                        {violation.code in RULE_CATALOG
                          ? RULE_CATALOG[violation.code as RuleCode].title
                          : 'Şoför çalışma kuralı'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${violation.severity}`}>{violation.severity === 'hard' ? 'sert' : 'yumuşak'}</span>
                    </td>
                    <td>{violation.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Hücre düzenle (elle, kilitlenir)</h3>
          <form className="inline" action={setCellAction}>
            <input type="hidden" name="week" value={weekStart} />
            <label>
              Araç
              <select name="plate" required defaultValue="">
                <option value="" disabled>
                  seç
                </option>
                {snapshot.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plate}>
                    {vehicle.plate}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Gün
              <select name="dayIndex" required defaultValue="1">
                {snapshot.days.map((day) => (
                  <option key={day.dayIndex} value={day.dayIndex}>
                    {dayLabel(day.dayType)} {day.date.slice(5)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kod
              <input name="code" placeholder="9A · -20 · x · 12.00 · YAT" required />
            </label>
            <button type="submit">Kaydet</button>
          </form>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Hücre kodları tablodaki gibi yazılır: hat kodu (<code>9A</code>), ek görev (
            <code>-20</code>), nöbet (<code>x</code>), ilk sefer saati (<code>12.00</code>), yatan araç (
            <code>YAT</code> veya boş).
          </p>
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
