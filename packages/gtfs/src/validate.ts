import { DAY_FLAGS, type GtfsFeed } from './types'
import { parseGtfsTime } from './types'

export type GtfsValidationIssue = {
  readonly level: 'error' | 'warning'
  readonly code: string
  readonly message: string
}

/**
 * Feed validation — a deliberate subset of MobilityData's gtfs-validator covering what
 * this product can produce or import. Not a replacement: the export pipeline still runs
 * the canonical validator in CI when it is available.
 */
export function validateGtfsFeed(feed: GtfsFeed): GtfsValidationIssue[] {
  const issues: GtfsValidationIssue[] = []
  const routeIds = new Set<string>()
  const stopIds = new Set<string>()
  const serviceIds = new Set<string>()
  const tripIds = new Set<string>()

  if (feed.agency.agencyName.trim() === '') {
    issues.push({ level: 'error', code: 'agency-name', message: 'agency.txt: agency_name is empty' })
  }
  if (!/^[A-Za-z_/]+$/.test(feed.agency.agencyTimezone)) {
    issues.push({
      level: 'warning',
      code: 'agency-timezone',
      message: `agency.txt: suspicious timezone "${feed.agency.agencyTimezone}"`,
    })
  }

  for (const stop of feed.stops) {
    if (stop.stopId === '') {
      issues.push({ level: 'error', code: 'stop-id', message: 'stops.txt: stop_id is empty' })
    }
    if (stopIds.has(stop.stopId)) {
      issues.push({ level: 'error', code: 'stop-id-duplicate', message: `stops.txt: duplicate stop_id ${stop.stopId}` })
    }
    stopIds.add(stop.stopId)

    if (stop.stopLat !== null && (stop.stopLat < -90 || stop.stopLat > 90)) {
      issues.push({ level: 'error', code: 'stop-lat', message: `stops.txt: ${stop.stopId} latitude out of range` })
    }
    if (stop.stopLon !== null && (stop.stopLon < -180 || stop.stopLon > 180)) {
      issues.push({ level: 'error', code: 'stop-lon', message: `stops.txt: ${stop.stopId} longitude out of range` })
    }
  }

  for (const route of feed.routes) {
    if (routeIds.has(route.routeId)) {
      issues.push({ level: 'error', code: 'route-id-duplicate', message: `routes.txt: duplicate route_id ${route.routeId}` })
    }
    routeIds.add(route.routeId)
    if (route.routeType !== 3) {
      issues.push({
        level: 'warning',
        code: 'route-type',
        message: `routes.txt: ${route.routeId} route_type ${route.routeType} is not bus (3)`,
      })
    }
  }

  for (const calendar of feed.calendars) {
    if (serviceIds.has(calendar.serviceId)) {
      issues.push({
        level: 'error',
        code: 'service-id-duplicate',
        message: `calendar.txt: duplicate service_id ${calendar.serviceId}`,
      })
    }
    serviceIds.add(calendar.serviceId)
    if (!DAY_FLAGS.some((flag) => calendar.days[flag.day])) {
      issues.push({
        level: 'error',
        code: 'service-no-days',
        message: `calendar.txt: ${calendar.serviceId} has no active day`,
      })
    }
  }

  for (const trip of feed.trips) {
    if (tripIds.has(trip.tripId)) {
      issues.push({ level: 'error', code: 'trip-id-duplicate', message: `trips.txt: duplicate trip_id ${trip.tripId}` })
    }
    tripIds.add(trip.tripId)
    if (!routeIds.has(trip.routeId)) {
      issues.push({
        level: 'error',
        code: 'trip-route',
        message: `trips.txt: ${trip.tripId} references unknown route ${trip.routeId}`,
      })
    }
    if (!serviceIds.has(trip.serviceId)) {
      issues.push({
        level: 'error',
        code: 'trip-service',
        message: `trips.txt: ${trip.tripId} references unknown service ${trip.serviceId}`,
      })
    }
  }

  const previousSequence = new Map<string, number>()
  const previousArrival = new Map<string, number>()
  for (const stopTime of feed.stopTimes) {
    if (!tripIds.has(stopTime.tripId)) {
      issues.push({
        level: 'error',
        code: 'stop-time-trip',
        message: `stop_times.txt: unknown trip ${stopTime.tripId}`,
      })
    }
    if (!stopIds.has(stopTime.stopId)) {
      issues.push({
        level: 'error',
        code: 'stop-time-stop',
        message: `stop_times.txt: ${stopTime.tripId} references unknown stop ${stopTime.stopId}`,
      })
    }

    const lastSequence = previousSequence.get(stopTime.tripId)
    if (lastSequence !== undefined && stopTime.stopSequence <= lastSequence) {
      issues.push({
        level: 'error',
        code: 'stop-sequence',
        message: `stop_times.txt: ${stopTime.tripId} stop_sequence ${stopTime.stopSequence} is not increasing`,
      })
    }
    previousSequence.set(stopTime.tripId, stopTime.stopSequence)

    let arrival: number
    let departure: number
    try {
      arrival = parseGtfsTime(stopTime.arrivalTime)
      departure = parseGtfsTime(stopTime.departureTime)
    } catch (error) {
      issues.push({
        level: 'error',
        code: 'stop-time-format',
        message: `stop_times.txt: ${stopTime.tripId}: ${(error as Error).message}`,
      })
      continue
    }

    if (departure < arrival) {
      issues.push({
        level: 'error',
        code: 'stop-time-order',
        message: `stop_times.txt: ${stopTime.tripId} departs (${stopTime.departureTime}) before arriving (${stopTime.arrivalTime})`,
      })
    }

    const lastArrival = previousArrival.get(stopTime.tripId)
    if (lastArrival !== undefined && arrival < lastArrival) {
      issues.push({
        level: 'error',
        code: 'stop-time-monotonic',
        message: `stop_times.txt: ${stopTime.tripId} goes backwards in time (${stopTime.arrivalTime})`,
      })
    }
    previousArrival.set(stopTime.tripId, arrival)
  }

  for (const trip of feed.trips) {
    if (!feed.stopTimes.some((stopTime) => stopTime.tripId === trip.tripId)) {
      issues.push({
        level: 'error',
        code: 'trip-no-stops',
        message: `trips.txt: ${trip.tripId} has no stop_times`,
      })
    }
  }

  return issues
}

export function hasErrors(issues: readonly GtfsValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error')
}
