import { asc, eq } from 'drizzle-orm'
import { cellLabel, dayIndex, DAY_TYPES, type DayType } from '@citybus/domain'
import { routes, vehicles } from '@citybus/db'
import { buildWeeklyWorkbook, type WeeklySheetRow } from '@citybus/xlsx'
import { getSession } from '@/lib/auth'
import { getDb, getOrganisation } from '@/lib/db'
import { groupDayForWeek, loadPlan, mondayOf } from '@/lib/plan'
import { dayLabel } from '@/lib/time'

export const dynamic = 'force-dynamic'

/** Weekly plan workbook in the operator's own layout. Auth: any signed-in user. */
export async function GET(request: Request) {
  const session = await getSession()
  if (session === null) {
    return new Response('Unauthorized', { status: 401 })
  }

  const organisation = await getOrganisation()
  const url = new URL(request.url)
  const weekStart = mondayOf(url.searchParams.get('week') ?? new Date().toISOString().slice(0, 10))
  const db = getDb()
  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, weekStart)

  const [vehicleRows, routeRows] = await Promise.all([
    db
      .select()
      .from(vehicles)
      .where(eq(vehicles.organisationId, organisation.id))
      .orderBy(asc(vehicles.plateNumber)),
    db.select().from(routes).where(eq(routes.organisationId, organisation.id)),
  ])

  const groupsById = new Map(plan.snapshot.groups.map((group) => [group.id, group]))
  const routesById = new Map(plan.snapshot.routes.map((route) => [route.id, route]))
  const routeCodeById = new Map(routeRows.map((route) => [route.id, route.code]))

  const assignmentByVehicleDay = new Map(
    plan.snapshot.assignments.map((assignment) => [
      `${assignment.vehicleId}:${assignment.dayIndex}`,
      assignment,
    ]),
  )
  const standbyByVehicleDay = new Map(
    plan.snapshot.standbys.map((standby) => [`${standby.vehicleId}:${standby.dayIndex}`, standby]),
  )

  const rows: WeeklySheetRow[] = vehicleRows.map((vehicle, index) => {
    const cells = DAY_TYPES.map((dayType: DayType) => {
      const index_ = dayIndex(dayType)
      const standby = standbyByVehicleDay.get(`${vehicle.id}:${index_}`)
      if (standby !== undefined) return 'x'
      const assignment = assignmentByVehicleDay.get(`${vehicle.id}:${index_}`)
      if (assignment === undefined) return ''
      return cellLabel(assignment, groupsById, routesById)
    })

    const standbyRow = DAY_TYPES.map((dayType: DayType) => {
      const standby = standbyByVehicleDay.get(`${vehicle.id}:${dayIndex(dayType)}`)
      if (standby === undefined) return null
      const routeId = standby.routeId
      return routeId === null ? standby.rawCode : routeCodeById.get(routeId) ?? standby.rawCode
    }).filter((value): value is string => value !== null)

    return {
      sequence: index + 1,
      plate: vehicle.plateNumber,
      cells,
      standbyCode: standbyRow.join(' '),
    }
  })

  const dailyCounts = DAY_TYPES.map(
    (dayType: DayType) =>
      plan.snapshot.assignments.filter(
        (assignment) => assignment.status === 'duty' && assignment.dayIndex === dayIndex(dayType),
      ).length,
  )

  const rotation = plan.snapshot.groups.map((group) => ({
    group: group.name,
    dayLabel: dayLabel(dayTypeOf(groupDayForWeek(group.referenceDayIndex, plan.snapshot.weekOffset))),
    vehicleCount: group.vehicleCount,
  }))

  const buffer = await buildWeeklyWorkbook({
    organisationName: organisation.name,
    weekStart,
    dayLabels: DAY_TYPES.map((dayType: DayType) => dayLabel(dayType).toLocaleUpperCase('tr-TR')),
    rows,
    dailyCounts,
    rotation,
  })

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="haftalik-plan-${weekStart}.xlsx"`,
      'cache-control': 'no-store',
    },
  })
}

function dayTypeOf(index: number): string {
  const map: Record<number, string> = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    7: 'sunday',
  }
  return map[index] ?? 'monday'
}
