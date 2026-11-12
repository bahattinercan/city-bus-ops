import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { RULE_CATALOG, type RuleCode } from '@citybus/domain'
import { auditLog, defectReports, drivers, planVersions, ruleViolations } from '@citybus/db'
import { requireSession } from '@/lib/auth'
import { getDb, getOrganisation, getSql } from '@/lib/db'
import { loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel } from '@/lib/time'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  await requireSession(['admin', 'planner', 'dispatcher'])
  const params = await searchParams
  const organisation = await getOrganisation()
  const weekStart = mondayOf(params.week ?? new Date().toISOString().slice(0, 10))
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)

  const [violationSummary, driverCount, openDefects, planRows, auditRows] = await Promise.all([
    plan.version === null
      ? Promise.resolve([])
      : db
          .select({
            code: ruleViolations.code,
            severity: ruleViolations.severity,
            count: sql<number>`count(*)::int`,
          })
          .from(ruleViolations)
          .where(eq(ruleViolations.planVersionId, plan.version.id))
          .groupBy(ruleViolations.code, ruleViolations.severity)
          .orderBy(ruleViolations.code),
    db.select({ count: sql<number>`count(*)::int` }).from(drivers).where(eq(drivers.organisationId, organisation.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(defectReports)
      .where(and(eq(defectReports.organisationId, organisation.id), eq(defectReports.status, 'open'))),
    db
      .select()
      .from(planVersions)
      .where(eq(planVersions.organisationId, organisation.id))
      .orderBy(desc(planVersions.weekStart))
      .limit(8),
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organisationId, organisation.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(15),
  ])

  const dutyPerDay = new Map<number, number>()
  for (const assignment of plan.snapshot.assignments) {
    if (assignment.status !== 'duty') continue
    dutyPerDay.set(assignment.dayIndex, (dutyPerDay.get(assignment.dayIndex) ?? 0) + 1)
  }
  const dutyTotal = [...dutyPerDay.values()].reduce((sum, value) => sum + value, 0)
  const standbyTotal = plan.snapshot.standbys.length
  const vehicleCount = plan.snapshot.vehicles.filter((vehicle) => vehicle.status === 'active').length

  const kpi = await getSql()<{ km: string | null; trips: string }[]>`
    select coalesce(sum(t.end_minute - t.start_minute), 0)::text as km,
           count(*)::text as trips
    from trip t
    join route r on r.id = t.route_id
    where r.organisation_id = ${organisation.id}
  `
  const tripMinutes = Number(kpi[0]?.km ?? 0)
  const tripCount = Number(kpi[0]?.trips ?? 0)

  return (
    <>
      <h1>Raporlar</h1>
      <p className="lead">{weekStart} haftası · {organisation.name}</p>

      <form className="inline" action="/reports">
        <label>
          Hafta
          <input type="date" name="week" defaultValue={weekStart} />
        </label>
        <button type="submit" className="secondary">
          Git
        </button>
        <Link href={`/api/plan/xlsx?week=${weekStart}`} style={{ alignSelf: 'center' }}>
          Haftalık planı Excel olarak indir
        </Link>
      </form>

      <div className="grid">
        <div className="card">
          <div className="value">{dutyTotal}</div>
          <div className="label">Haftalık görev (araç-gün)</div>
        </div>
        <div className="card">
          <div className="value">{standbyTotal}</div>
          <div className="label">Nöbet günü</div>
        </div>
        <div className="card">
          <div className="value">{plan.snapshot.roster.length}</div>
          <div className="label">Şoför görevi</div>
        </div>
        <div className="card">
          <div className="value">{driverCount[0]?.count ?? 0}</div>
          <div className="label">Şoför</div>
        </div>
        <div className="card">
          <div className="value">{vehicleCount}</div>
          <div className="label">Aktif araç</div>
        </div>
        <div className="card">
          <div className="value">{openDefects[0]?.count ?? 0}</div>
          <div className="label">Açık arıza</div>
        </div>
        <div className="card">
          <div className="value">{tripCount}</div>
          <div className="label">Tanımlı sefer</div>
        </div>
        <div className="card">
          <div className="value">{Math.round(tripMinutes / 60)}</div>
          <div className="label">Tarife saati (toplam)</div>
        </div>
      </div>

      <h3>Günlük dağılım</h3>
      <table>
        <thead>
          <tr>
            <th>Gün</th>
            <th>Tarih</th>
            <th>Görev</th>
            <th>Nöbet</th>
          </tr>
        </thead>
        <tbody>
          {plan.snapshot.days.map((day) => (
            <tr key={day.dayIndex}>
              <td>{dayLabel(day.dayType)}</td>
              <td className="muted">{day.date}</td>
              <td>{dutyPerDay.get(day.dayIndex) ?? 0}</td>
              <td>{plan.snapshot.standbys.filter((standby) => standby.dayIndex === day.dayIndex).length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Kural ihlalleri</h3>
      {violationSummary.length === 0 ? (
        <div className="notice">Bu hafta için kayıtlı ihlal yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Kural</th>
              <th>Şiddet</th>
              <th>Adet</th>
            </tr>
          </thead>
          <tbody>
            {violationSummary.map((row) => (
              <tr key={`${row.code}-${row.severity}`}>
                <td>
                  <strong>{row.code}</strong>{' '}
                  <span className="muted">
                    {row.code in RULE_CATALOG ? RULE_CATALOG[row.code as RuleCode].title : 'şoför çalışma kuralı'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${row.severity}`}>{row.severity === 'hard' ? 'sert' : 'yumuşak'}</span>
                </td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Son işlemler (denetim izi)</h3>
      {auditRows.length === 0 ? (
        <div className="notice">Henüz denetim kaydı yok.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>İşlem</th>
              <th>Varlık</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <tr key={row.id}>
                <td className="muted">{row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td>
                  <strong>{row.action}</strong>
                </td>
                <td className="muted">
                  {row.entity}
                  {row.entityId === null ? '' : ` · ${row.entityId.slice(0, 8)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Plan geçmişi</h3>
      <table>
        <thead>
          <tr>
            <th>Hafta</th>
            <th>Durum</th>
            <th>Yayın</th>
          </tr>
        </thead>
        <tbody>
          {planRows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link href={`/plan?week=${row.weekStart}`}>{row.weekStart}</Link>
              </td>
              <td>
                <span className="badge">{row.status}</span>
              </td>
              <td className="muted">{row.publishedAt === null ? '—' : row.publishedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
          {planRows.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                Henüz plan yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}
