import { parseCsvObjects } from './csv'
import { DAY_FLAGS, GTFS_FILES, parseGtfsTime, type DayFlags, type GtfsCalendar, type GtfsFeed, type ParsedStopTime } from './types'

export type GtfsIssueLevel = 'error' | 'warning'

export type GtfsIssue = {
  readonly level: GtfsIssueLevel
  readonly file: string
  readonly message: string
}

export type GtfsReadResult = {
  readonly feed: GtfsFeed | null
  readonly issues: readonly GtfsIssue[]
}

/**
 * Reads GTFS files (already unzipped) into the in-memory model.
 * Structural problems become issues instead of exceptions so an importer can report
 * everything it found before touching the database.
 */
export function readGtfsFiles(files: Record<string, string | undefined>): GtfsReadResult {
  const issues: GtfsIssue[] = []

  const agencyRows = readFile(files, GTFS_FILES.agency, issues)
  const agencyRow = agencyRows[0]
  if (agencyRow === undefined) {
    issues.push({ level: 'error', file: GTFS_FILES.agency, message: 'agency.txt has no rows' })
    return { feed: null, issues }
  }

  const stops = readFile(files, GTFS_FILES.stops, issues).map((row) => ({
    stopId: row.stop_id ?? '',
    stopName: row.stop_name ?? '',
    stopLat: parseOptionalNumber(row.stop_lat, GTFS_FILES.stops, 'stop_lat', issues),
    stopLon: parseOptionalNumber(row.stop_lon, GTFS_FILES.stops, 'stop_lon', issues),
  }))

  const routes = readFile(files, GTFS_FILES.routes, issues).map((row) => ({
    routeId: row.route_id ?? '',
    shortName: row.route_short_name ?? row.route_id ?? '',
    longName: row.route_long_name ?? '',
    routeType: Number.parseInt(row.route_type ?? '3', 10),
  }))

  const trips = readFile(files, GTFS_FILES.trips, issues).map((row) => ({
    tripId: row.trip_id ?? '',
    routeId: row.route_id ?? '',
    serviceId: row.service_id ?? '',
  }))

  const stopTimes: ParsedStopTime[] = []
  for (const row of readFile(files, GTFS_FILES.stopTimes, issues)) {
    try {
      stopTimes.push({
        tripId: row.trip_id ?? '',
        stopId: row.stop_id ?? '',
        arrivalTime: row.arrival_time ?? '',
        departureTime: row.departure_time ?? '',
        stopSequence: Number.parseInt(row.stop_sequence ?? '', 10),
        arrivalMinute: parseGtfsTime(row.arrival_time ?? ''),
        departureMinute: parseGtfsTime(row.departure_time ?? ''),
      })
    } catch (error) {
      issues.push({
        level: 'error',
        file: GTFS_FILES.stopTimes,
        message: `trip ${row.trip_id ?? '?'}: ${(error as Error).message}`,
      })
    }
  }

  const calendars: GtfsCalendar[] = readFile(files, GTFS_FILES.calendar, issues).map((row) => {
    const days = Object.fromEntries(
      DAY_FLAGS.map((flag) => [flag.day, (row[flag.column] ?? '0') === '1']),
    ) as DayFlags
    return {
      serviceId: row.service_id ?? '',
      startDate: formatDate(row.start_date ?? ''),
      endDate: formatDate(row.end_date ?? ''),
      days,
    }
  })

  return {
    feed: {
      agency: {
        agencyId: agencyRow.agency_id ?? 'agency',
        agencyName: agencyRow.agency_name ?? '',
        agencyUrl: agencyRow.agency_url ?? '',
        agencyTimezone: agencyRow.agency_timezone ?? 'Europe/Istanbul',
        agencyLang: agencyRow.agency_lang ?? 'tr',
      },
      stops,
      routes,
      trips,
      stopTimes,
      calendars,
    },
    issues,
  }
}

function readFile(
  files: Record<string, string | undefined>,
  name: string,
  issues: GtfsIssue[],
): Record<string, string>[] {
  const content = files[name]
  if (content === undefined) {
    issues.push({ level: 'error', file: name, message: `${name} is missing` })
    return []
  }
  return parseCsvObjects(content)
}

function parseOptionalNumber(
  value: string | undefined,
  file: string,
  column: string,
  issues: GtfsIssue[],
): number | null {
  if (value === undefined || value.trim() === '') {
    return null
  }
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) {
    issues.push({ level: 'warning', file, message: `invalid ${column}: "${value}"` })
    return null
  }
  return parsed
}

/** GTFS uses YYYYMMDD. */
function formatDate(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }
  return value
}
