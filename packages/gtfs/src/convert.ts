import { DAY_TYPES, type DayType } from '@citybus/domain'
import type { GtfsCalendar, GtfsFeed, GtfsStopTime } from './types'
import { DAY_FLAGS, formatGtfsTime, parseGtfsTime } from './types'

/**
 * Adapter between our operational model and GTFS Schedule.
 *
 * Mapping decisions (kept stable so an export → import round trip is lossless):
 * - `route.code` is the GTFS `route_id`, `stop.code` the `stop_id` (the operator's codes are unique).
 * - one GTFS service per weekday type, service_id = `monday` ... `sunday`
 * - stop times come from `trip.stopTimes`; a trip without stop times is not exported
 */
export type NetworkRoute = {
  readonly code: string
  readonly name: string
  readonly requiredLowFloor?: boolean
  readonly requiredAc?: boolean
}

export type NetworkStop = {
  readonly code: string
  readonly name: string
  readonly latitude: number | null
  readonly longitude: number | null
}

export type NetworkTripStop = {
  readonly stopCode: string
  readonly sequence: number
  readonly arrivalMinute: number
  readonly departureMinute: number
}

export type NetworkTrip = {
  readonly id: string
  readonly routeCode: string
  readonly dayType: DayType
  readonly startMinute: number
  readonly endMinute: number
  readonly stops: readonly NetworkTripStop[]
}

export type Network = {
  readonly agencyName: string
  readonly agencyUrl: string
  readonly timezone: string
  readonly language: string
  /** Service window; the operator publishes per calendar year. */
  readonly startDate: string
  readonly endDate: string
  readonly routes: readonly NetworkRoute[]
  readonly stops: readonly NetworkStop[]
  readonly trips: readonly NetworkTrip[]
}

export type ConvertIssue = {
  readonly level: 'error' | 'warning'
  readonly message: string
}

export type ConvertResult<T> = {
  readonly value: T
  readonly issues: readonly ConvertIssue[]
}

export function toGtfsFeed(network: Network): ConvertResult<GtfsFeed> {
  const issues: ConvertIssue[] = []

  const trips = network.trips.filter((trip) => {
    if (trip.stops.length < 2) {
      issues.push({
        level: 'warning',
        message: `Sefer ${trip.id} en az iki durağı olmadığı için GTFS çıktısına alınmadı.`,
      })
      return false
    }
    return true
  })

  const usedDays = new Set<DayType>(trips.map((trip) => trip.dayType))
  const calendars: GtfsCalendar[] = [...usedDays].map((dayType) => ({
    serviceId: dayType,
    startDate: network.startDate,
    endDate: network.endDate,
    days: Object.fromEntries(DAY_FLAGS.map((flag) => [flag.day, flag.day === dayType])) as GtfsCalendar['days'],
  }))

  const stopTimes: GtfsStopTime[] = []
  for (const trip of trips) {
    for (const stop of [...trip.stops].sort((a, b) => a.sequence - b.sequence)) {
      stopTimes.push({
        tripId: trip.id,
        stopId: stop.stopCode,
        arrivalTime: formatGtfsTime(stop.arrivalMinute),
        departureTime: formatGtfsTime(stop.departureMinute),
        stopSequence: stop.sequence,
      })
    }
  }

  return {
    value: {
      agency: {
        agencyId: 'citybus',
        agencyName: network.agencyName,
        agencyUrl: network.agencyUrl,
        agencyTimezone: network.timezone,
        agencyLang: network.language,
      },
      stops: network.stops.map((stop) => ({
        stopId: stop.code,
        stopName: stop.name,
        stopLat: stop.latitude,
        stopLon: stop.longitude,
      })),
      routes: network.routes.map((route) => ({
        routeId: route.code,
        shortName: route.code,
        longName: route.name,
        routeType: 3,
      })),
      trips: trips.map((trip) => ({ tripId: trip.id, routeId: trip.routeCode, serviceId: trip.dayType })),
      stopTimes,
      calendars,
    },
    issues,
  }
}

/** Inverse of {@link toGtfsFeed}. Unknown services and trips without stops become issues. */
export function fromGtfsFeed(feed: GtfsFeed): ConvertResult<Network> {
  const issues: ConvertIssue[] = []
  const dayByService = new Map<string, DayType>()

  for (const calendar of feed.calendars) {
    const active = DAY_FLAGS.filter((flag) => calendar.days[flag.day]).map((flag) => flag.day)
    const first = active[0]
    if (active.length !== 1 || first === undefined) {
      issues.push({
        level: 'warning',
        message: `Servis ${calendar.serviceId} tam olarak bir güne denk gelmiyor (${active.join(', ') || 'boş'}), atlandı.`,
      })
      continue
    }
    dayByService.set(calendar.serviceId, first)
  }

  const stopTimesByTrip = new Map<string, GtfsStopTime[]>()
  for (const stopTime of feed.stopTimes) {
    const list = stopTimesByTrip.get(stopTime.tripId) ?? []
    list.push(stopTime)
    stopTimesByTrip.set(stopTime.tripId, list)
  }

  const trips: NetworkTrip[] = []
  for (const trip of feed.trips) {
    const dayType = dayByService.get(trip.serviceId)
    if (dayType === undefined) {
      issues.push({
        level: 'warning',
        message: `Sefer ${trip.tripId} bilinmeyen servise bağlı (${trip.serviceId}), atlandı.`,
      })
      continue
    }

    const times = (stopTimesByTrip.get(trip.tripId) ?? []).sort((a, b) => a.stopSequence - b.stopSequence)
    if (times.length < 2) {
      issues.push({
        level: 'warning',
        message: `Sefer ${trip.tripId} iki duraktan az içeriyor, atlandı.`,
      })
      continue
    }

    const first = times[0]
    const last = times[times.length - 1]
    if (first === undefined || last === undefined) continue

    trips.push({
      id: trip.tripId,
      routeCode: trip.routeId,
      dayType,
      startMinute: parseGtfsTime(first.arrivalTime),
      endMinute: parseGtfsTime(last.departureTime),
      stops: times.map((time) => ({
        stopCode: time.stopId,
        sequence: time.stopSequence,
        arrivalMinute: parseGtfsTime(time.arrivalTime),
        departureMinute: parseGtfsTime(time.departureTime),
      })),
    })
  }

  return {
    value: {
      agencyName: feed.agency.agencyName,
      agencyUrl: feed.agency.agencyUrl,
      timezone: feed.agency.agencyTimezone,
      language: feed.agency.agencyLang,
      startDate: feed.calendars[0]?.startDate ?? '2026-01-01',
      endDate: feed.calendars[0]?.endDate ?? '2026-12-31',
      routes: feed.routes.map((route) => ({
        code: route.shortName === '' ? route.routeId : route.shortName,
        name: route.longName,
      })),
      stops: feed.stops.map((stop) => ({
        code: stop.stopId,
        name: stop.stopName,
        latitude: stop.stopLat,
        longitude: stop.stopLon,
      })),
      trips,
    },
    issues,
  }
}

/** Even stop times across a trip's stops — a planner can then adjust a single stop. */
export function spreadStopTimes(
  stopCodes: readonly string[],
  startMinute: number,
  endMinute: number,
): NetworkTripStop[] {
  if (stopCodes.length < 2) {
    throw new Error('A trip needs at least two stops')
  }
  const step = (endMinute - startMinute) / (stopCodes.length - 1)
  return stopCodes.map((stopCode, index) => {
    const minute = Math.round(startMinute + step * index)
    return { stopCode, sequence: index + 1, arrivalMinute: minute, departureMinute: minute }
  })
}

export const NETWORK_DAY_TYPES = DAY_TYPES
