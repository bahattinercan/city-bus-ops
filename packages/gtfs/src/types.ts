import type { DayType } from '@citybus/domain'

/** In-memory GTFS Schedule feed. Only the files this product can fill are modelled. */
export type GtfsAgency = {
  readonly agencyId: string
  readonly agencyName: string
  readonly agencyUrl: string
  readonly agencyTimezone: string
  readonly agencyLang: string
}

export type GtfsStop = {
  readonly stopId: string
  readonly stopName: string
  readonly stopLat: number | null
  readonly stopLon: number | null
}

export type GtfsRoute = {
  readonly routeId: string
  readonly shortName: string
  readonly longName: string
  /** 3 = bus. */
  readonly routeType: number
}

export type GtfsTrip = {
  readonly tripId: string
  readonly routeId: string
  readonly serviceId: string
}

/** `HH:MM:SS`, hours may exceed 24 for after-midnight service. */
export type GtfsStopTime = {
  readonly tripId: string
  readonly stopId: string
  readonly arrivalTime: string
  readonly departureTime: string
  readonly stopSequence: number
}

/** Stop time with the parsed minutes kept alongside the GTFS string form. */
export type ParsedStopTime = GtfsStopTime & {
  readonly arrivalMinute: number
  readonly departureMinute: number
}

export type DayFlags = Readonly<Record<DayType, boolean>>

export type GtfsCalendar = {
  readonly serviceId: string
  readonly startDate: string
  readonly endDate: string
  readonly days: DayFlags
}

export type GtfsFeed = {
  readonly agency: GtfsAgency
  readonly stops: readonly GtfsStop[]
  readonly routes: readonly GtfsRoute[]
  readonly trips: readonly GtfsTrip[]
  readonly stopTimes: readonly GtfsStopTime[]
  readonly calendars: readonly GtfsCalendar[]
}

export const GTFS_FILES = {
  agency: 'agency.txt',
  stops: 'stops.txt',
  routes: 'routes.txt',
  trips: 'trips.txt',
  stopTimes: 'stop_times.txt',
  calendar: 'calendar.txt',
} as const

export const MAX_MINUTES = 48 * 60

/** Minutes after midnight to GTFS `HH:MM:SS`. Hours above 24 are legal and preserved. */
export function formatGtfsTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES) {
    throw new Error(`Invalid service time in minutes: ${minutes}`)
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}:00`
}

export function parseGtfsTime(value: string): number {
  const match = /^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim())
  if (match === null || match[1] === undefined || match[2] === undefined) {
    throw new Error(`Invalid GTFS time: "${value}"`)
  }
  const minutes = Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10)
  if (minutes > MAX_MINUTES) {
    throw new Error(`GTFS time out of range: "${value}"`)
  }
  return minutes
}

export const DAY_FLAGS: readonly { readonly column: string; readonly day: DayType }[] = [
  { column: 'monday', day: 'monday' },
  { column: 'tuesday', day: 'tuesday' },
  { column: 'wednesday', day: 'wednesday' },
  { column: 'thursday', day: 'thursday' },
  { column: 'friday', day: 'friday' },
  { column: 'saturday', day: 'saturday' },
  { column: 'sunday', day: 'sunday' },
]
