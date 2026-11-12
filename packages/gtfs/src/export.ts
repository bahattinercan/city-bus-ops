import { formatCsv } from './csv'
import { DAY_FLAGS, GTFS_FILES, formatGtfsTime, type GtfsFeed } from './types'

/** Builds the GTFS Schedule files as text, keyed by filename. */
export function buildGtfsFiles(feed: GtfsFeed): Record<string, string> {
  const files: Record<string, string> = {}

  files[GTFS_FILES.agency] = formatCsv([
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang'],
    [feed.agency.agencyId, feed.agency.agencyName, feed.agency.agencyUrl, feed.agency.agencyTimezone, feed.agency.agencyLang],
  ])

  files[GTFS_FILES.stops] = formatCsv([
    ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'],
    ...feed.stops.map((stop) => [stop.stopId, stop.stopName, stop.stopLat, stop.stopLon]),
  ])

  files[GTFS_FILES.routes] = formatCsv([
    ['route_id', 'route_short_name', 'route_long_name', 'route_type'],
    ...feed.routes.map((route) => [route.routeId, route.shortName, route.longName, route.routeType]),
  ])

  files[GTFS_FILES.trips] = formatCsv([
    ['trip_id', 'route_id', 'service_id'],
    ...feed.trips.map((trip) => [trip.tripId, trip.routeId, trip.serviceId]),
  ])

  files[GTFS_FILES.stopTimes] = formatCsv([
    ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
    ...feed.stopTimes.map((time) => [
      time.tripId,
      time.arrivalTime,
      time.departureTime,
      time.stopId,
      time.stopSequence,
    ]),
  ])

  files[GTFS_FILES.calendar] = formatCsv([
    ['service_id', ...DAY_FLAGS.map((flag) => flag.column), 'start_date', 'end_date'],
    ...feed.calendars.map((calendar) => [
      calendar.serviceId,
      ...DAY_FLAGS.map((flag) => (calendar.days[flag.day] ? 1 : 0)),
      calendar.startDate.replace(/-/g, ''),
      calendar.endDate.replace(/-/g, ''),
    ]),
  ])

  return files
}

/** Convenience for callers that have a trip start/end pair but no stop times yet. */
export function tripTimes(startMinute: number, endMinute: number): { arrival: string; departure: string } {
  return { arrival: formatGtfsTime(startMinute), departure: formatGtfsTime(endMinute) }
}
