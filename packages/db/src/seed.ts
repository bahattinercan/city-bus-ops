import type { createDb } from './client'
import { asc, eq } from 'drizzle-orm'
import { DAY_TYPES } from '@citybus/domain'
import {
  depots,
  drivers,
  dutyGroups,
  organisations,
  routeStops,
  routes,
  stops,
  tripStopTimes,
  trips,
  vehicles,
} from './schema'

/**
 * Reference data for the Kütahya fleet, taken verbatim from the legacy analysis
 * (`docs/legacy-domain-analysis.md` §5 and §6.1):
 *
 * - 45 fleet numbers: 41 printed on the sheet plus 134/186/225/229 written by hand (O5)
 * - 12 route codes that the legacy analysis could confirm as routes
 * - 4 duty groups with their anchor weekday (`g0`) for the 7-week rotation law
 *
 * Route names are intentionally left equal to the code: no source documented them, and
 * inventing a name would make the data look authoritative when it is not.
 */
const PRINTED_PLATES = [
  '003', '030', '042', '050', '053', '060', '080', '085', '086', '100',
  '125', '128', '129', '130', '146', '147', '153', '159', '160', '166',
  '176', '184', '188', '190', '198', '200', '203', '205', '208', '221',
  '226', '235', '251', '253', '260', '271', '272', '277', '284', '285', '286',
] as const

const HANDWRITTEN_PLATES = ['134', '186', '225', '229'] as const

const ROUTE_CODES = [
  '7A', '8A', '9A', '9AT', '10A', '12A', '26A', '26B', '26E', '27A', '27B', '27E',
] as const

const DUTY_GROUPS = [
  { code: 'TOKI', name: '(6) Toki', vehicleCount: 6, referenceDayIndex: 3 },
  { code: 'SELEBI', name: '(2) F.Şelebi', vehicleCount: 2, referenceDayIndex: 6 },
  { code: 'CUKUR', name: '(5) B.Çukur', vehicleCount: 5, referenceDayIndex: 1 },
  { code: 'KAMPUS', name: '(1) Kampüs/Konya', vehicleCount: 1, referenceDayIndex: 5 },
] as const

/**
 * Demo drivers. The operator's real list (name, licence class, seniority) is still an open
 * input (docs/05-roadmap.md M4 gate); these rows exist so rosters and the driver app can be
 * exercised end to end, and are marked with a `DEMO-` employee number on purpose.
 */
const DEMO_DRIVERS = Array.from({ length: 20 }, (_, index) => {
  const no = String(index + 1).padStart(2, '0')
  return { employeeNo: `DEMO-${no}`, fullName: `Demo Şoför ${no}`, seniority: 100 - index }
})

/**
 * Demo timetable for one route so the planning screens, run cutting and the driver app can
 * be exercised without the operator's real data. Every trip is 40 minutes, every 10 minutes
 * between 06:00 and 22:00, on all seven day types. Clearly marked as demo in the docs — real
 * timetables arrive through the GTFS import or the network editor.
 */
const DEMO_ROUTE_CODE = '9A'
const DEMO_STOPS = [
  { code: 'S1', name: 'Otogar', latitude: '39.4200', longitude: '29.9800' },
  { code: 'S2', name: 'Cumhuriyet', latitude: '39.4242', longitude: '29.9855' },
  { code: 'S3', name: 'Yeni Mahalle', latitude: null, longitude: null },
]
const DEMO_FIRST_DEPARTURE = 6 * 60
const DEMO_LAST_DEPARTURE = 22 * 60
const DEMO_TRIP_MINUTES = 40
const DEMO_HEADWAY_MINUTES = 10

export const SEED_SUMMARY = {
  organisationSlug: 'kutahya',
  /** 41 printed + 4 handwritten fleet numbers. */
  vehicleCount: PRINTED_PLATES.length + HANDWRITTEN_PLATES.length,
  routeCount: ROUTE_CODES.length,
  dutyGroupCount: DUTY_GROUPS.length,
  driverCount: DEMO_DRIVERS.length,
  demoTripsPerDay:
    Math.floor((DEMO_LAST_DEPARTURE - DEMO_FIRST_DEPARTURE) / DEMO_HEADWAY_MINUTES) + 1,
  demoTripsTotal:
    (Math.floor((DEMO_LAST_DEPARTURE - DEMO_FIRST_DEPARTURE) / DEMO_HEADWAY_MINUTES) + 1) * DAY_TYPES.length,
} as const

export async function seedReferenceData(handle: ReturnType<typeof createDb>) {
  const { db } = handle

  const [organisation] = await db
    .insert(organisations)
    .values({
      slug: SEED_SUMMARY.organisationSlug,
      name: 'Kütahya Şehir İçi Ulaşım',
      rotationAnchorWeek: '2026-09-21',
    })
    .onConflictDoUpdate({
      target: organisations.slug,
      set: { name: 'Kütahya Şehir İçi Ulaşım', rotationAnchorWeek: '2026-09-21' },
    })
    .returning()

  if (organisation === undefined) {
    throw new Error('Seed failed: organisation was not returned')
  }

  const organisationId = organisation.id

  await db
    .insert(depots)
    .values({ organisationId, code: 'MERKEZ', name: 'Merkez Garaj' })
    .onConflictDoNothing()

  await db
    .insert(vehicles)
    .values([
      ...PRINTED_PLATES.map((plateNumber) => ({
        organisationId,
        plateNumber,
        source: 'printed' as const,
        capacity: 90,
        lowFloor: false,
        airConditioned: true,
      })),
      ...HANDWRITTEN_PLATES.map((plateNumber) => ({
        organisationId,
        plateNumber,
        source: 'handwritten' as const,
        capacity: 90,
        lowFloor: false,
        airConditioned: true,
      })),
    ])
    .onConflictDoNothing()

  await db
    .insert(routes)
    .values(ROUTE_CODES.map((code) => ({ organisationId, code, name: code })))
    .onConflictDoNothing()

  await db
    .insert(drivers)
    .values(DEMO_DRIVERS.map((driver) => ({ organisationId, ...driver })))
    .onConflictDoNothing()

  await db
    .insert(dutyGroups)
    .values(DUTY_GROUPS.map((group) => ({ organisationId, ...group })))
    .onConflictDoNothing()

  await seedDemoTimetable(handle, organisationId)

  return { organisationId }
}

async function seedDemoTimetable(handle: ReturnType<typeof createDb>, organisationId: string) {
  const { db } = handle

  await db
    .insert(stops)
    .values(DEMO_STOPS.map((stop) => ({ organisationId, ...stop })))
    .onConflictDoNothing()

  const stopRows = await db.select().from(stops).where(eq(stops.organisationId, organisationId))
  const stopIdByCode = new Map(stopRows.map((row) => [row.code, row.id]))

  const routeRows = await db
    .select()
    .from(routes)
    .where(eq(routes.organisationId, organisationId))
    .orderBy(asc(routes.code))
  const demoRoute = routeRows.find((row) => row.code === DEMO_ROUTE_CODE)
  if (demoRoute === undefined) return

  await db
    .update(dutyGroups)
    .set({ defaultRouteId: demoRoute.id })
    .where(eq(dutyGroups.organisationId, organisationId))

  for (const [index, stop] of DEMO_STOPS.entries()) {
    const stopId = stopIdByCode.get(stop.code)
    if (stopId === undefined) continue
    await db
      .insert(routeStops)
      .values({ routeId: demoRoute.id, stopId, direction: 0, sequence: index + 1 })
      .onConflictDoNothing()
  }

  const tripValues: {
    routeId: string
    dayType: (typeof DAY_TYPES)[number]
    startMinute: number
    endMinute: number
    crossesMidnight: boolean
  }[] = []

  for (const dayType of DAY_TYPES) {
    for (let start = DEMO_FIRST_DEPARTURE; start <= DEMO_LAST_DEPARTURE; start += DEMO_HEADWAY_MINUTES) {
      const end = start + DEMO_TRIP_MINUTES
      tripValues.push({
        routeId: demoRoute.id,
        dayType,
        startMinute: start,
        endMinute: end,
        crossesMidnight: end > 1440,
      })
    }
  }

  const insertedTrips = await db
    .insert(trips)
    .values(tripValues)
    .onConflictDoNothing()
    .returning({ id: trips.id, startMinute: trips.startMinute })

  if (insertedTrips.length === 0) return

  const step = Math.round(DEMO_TRIP_MINUTES / (DEMO_STOPS.length - 1))
  const stopTimeValues = insertedTrips.flatMap((trip) =>
    DEMO_STOPS.flatMap((stop, index) => {
      const stopId = stopIdByCode.get(stop.code)
      if (stopId === undefined) return []
      const minute = trip.startMinute + step * index
      return [
        {
          tripId: trip.id,
          stopId,
          sequence: index + 1,
          arrivalMinute: minute,
          departureMinute: minute,
        },
      ]
    }),
  )

  await db.insert(tripStopTimes).values(stopTimeValues)

}
