import { asc, eq } from 'drizzle-orm'
import { routes, stops, tripStopTimes, trips } from '@citybus/db'
import { buildGtfsFiles, createZip, toGtfsFeed, type Network } from '@citybus/gtfs'
import { getDb, getOrganisation } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GTFS Schedule download. The feed is generated from the operational master on every
 * request — there is no separate published copy that can drift from the planning data.
 */
export async function GET() {
  const organisation = await getOrganisation()
  const db = getDb()

  const routeRows = await db
    .select()
    .from(routes)
    .where(eq(routes.organisationId, organisation.id))
    .orderBy(asc(routes.code))
  const routeById = new Map(routeRows.map((route) => [route.id, route]))

  const stopRows = await db
    .select()
    .from(stops)
    .where(eq(stops.organisationId, organisation.id))
    .orderBy(asc(stops.code))
  const stopById = new Map(stopRows.map((stop) => [stop.id, stop]))

  const allTrips = await db
    .select()
    .from(trips)
    .orderBy(asc(trips.dayType), asc(trips.startMinute))
  const tripRows = allTrips.filter((trip) => routeById.has(trip.routeId))

  const timeRows = await db
    .select()
    .from(tripStopTimes)
    .orderBy(asc(tripStopTimes.tripId), asc(tripStopTimes.sequence))

  const timesByTrip = new Map<string, typeof timeRows>()
  for (const row of timeRows) {
    const list = timesByTrip.get(row.tripId) ?? []
    list.push(row)
    timesByTrip.set(row.tripId, list)
  }

  const network: Network = {
    agencyName: organisation.name,
    agencyUrl: 'https://example.invalid',
    timezone: 'Europe/Istanbul',
    language: 'tr',
    startDate: `${new Date().getUTCFullYear()}-01-01`,
    endDate: `${new Date().getUTCFullYear() + 1}-12-31`,
    routes: routeRows.map((route) => ({
      code: route.code,
      name: route.name,
      requiredLowFloor: route.requiredLowFloor,
      requiredAc: route.requiredAc,
    })),
    stops: stopRows.map((stop) => ({
      code: stop.code,
      name: stop.name,
      latitude: stop.latitude === null ? null : Number.parseFloat(stop.latitude),
      longitude: stop.longitude === null ? null : Number.parseFloat(stop.longitude),
    })),
    trips: tripRows.flatMap((trip) => {
      const route = routeById.get(trip.routeId)
      if (route === undefined) return []
      const times = timesByTrip.get(trip.id) ?? []
      return [
        {
          id: trip.id,
          routeCode: route.code,
          dayType: trip.dayType,
          startMinute: trip.startMinute,
          endMinute: trip.endMinute,
          stops: times.flatMap((time) => {
            const stop = stopById.get(time.stopId)
            if (stop === undefined) return []
            return [
              {
                stopCode: stop.code,
                sequence: time.sequence,
                arrivalMinute: time.arrivalMinute,
                departureMinute: time.departureMinute,
              },
            ]
          }),
        },
      ]
    }),
  }

  const { value: feed, issues } = toGtfsFeed(network)
  const files = buildGtfsFiles(feed)
  const archive = createZip(files)

  return new Response(archive, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="gtfs-${organisation.id.slice(0, 8)}.zip"`,
      'x-citybus-warnings': String(issues.length),
      'cache-control': 'no-store',
    },
  })
}
