import { describe, expect, it } from 'vitest'
import type { DayType } from '@citybus/domain'
import { fromGtfsFeed, spreadStopTimes, toGtfsFeed, type Network } from './convert'
import { buildGtfsFiles } from './export'
import { readGtfsFiles } from './import'
import { DAY_FLAGS, GTFS_FILES } from './types'
import { hasErrors, validateGtfsFeed } from './validate'

const days = Object.fromEntries(DAY_FLAGS.map((flag) => [flag.day, false])) as Record<DayType, boolean>

export function sampleNetwork(): Network {
  return {
    agencyName: 'Kütahya Şehir İçi Ulaşım',
    agencyUrl: 'https://example.invalid',
    timezone: 'Europe/Istanbul',
    language: 'tr',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    routes: [
      { code: '5', name: '5' },
      { code: '9AT', name: '9AT' },
    ],
    stops: [
      { code: 'S1', name: 'Otogar', latitude: 39.42, longitude: 29.98 },
      { code: 'S2', name: 'Cumhuriyet, merkez', latitude: 39.4242, longitude: 29.9855 },
      { code: 'S3', name: 'Yeni Mahalle', latitude: null, longitude: null },
    ],
    trips: [
      {
        id: 'T1',
        routeCode: '5',
        dayType: 'monday',
        startMinute: 6 * 60,
        endMinute: 6 * 60 + 40,
        stops: spreadStopTimes(['S1', 'S2', 'S3'], 6 * 60, 6 * 60 + 40),
      },
      {
        id: 'T2',
        routeCode: '9AT',
        dayType: 'sunday',
        startMinute: 23 * 60 + 30,
        endMinute: 24 * 60 + 10,
        stops: spreadStopTimes(['S3', 'S2'], 23 * 60 + 30, 24 * 60 + 10),
      },
    ],
  }
}

describe('GTFS export', () => {
  it('writes the six required files with headers', () => {
    const { value: feed } = toGtfsFeed(sampleNetwork())
    const files = buildGtfsFiles(feed)

    for (const name of Object.values(GTFS_FILES)) {
      expect(files[name], name).toBeDefined()
      expect(files[name]?.split('\n')[0]).not.toBe('')
    }

    expect(files[GTFS_FILES.routes]).toContain('5,5,5,3')
    expect(files[GTFS_FILES.stops]).toContain('"Cumhuriyet, merkez"')
    expect(files[GTFS_FILES.stopTimes]).toContain('23:30:00')
    expect(files[GTFS_FILES.stopTimes]).toContain('24:10:00')
  })

  it('produces a feed that passes validation', () => {
    const { value: feed } = toGtfsFeed(sampleNetwork())
    const issues = validateGtfsFeed(feed)
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(hasErrors(issues)).toBe(false)
  })

  it('drops trips with fewer than two stops and says so', () => {
    const network = sampleNetwork()
    const broken: Network = {
      ...network,
      trips: [...network.trips, { ...network.trips[0]!, id: 'T3', stops: [] }],
    }
    const { value: feed, issues } = toGtfsFeed(broken)
    expect(feed.trips.map((trip) => trip.tripId)).toEqual(['T1', 'T2'])
    expect(issues).toHaveLength(1)
  })
})

describe('GTFS import', () => {
  it('round-trips a feed back into the operational model', () => {
    const original = sampleNetwork()
    const { value: feed } = toGtfsFeed(original)
    const files = buildGtfsFiles(feed)

    const read = readGtfsFiles(files)
    expect(read.issues.filter((issue) => issue.level === 'error')).toEqual([])
    if (read.feed === null) throw new Error('feed was not read')

    const { value: restored, issues } = fromGtfsFeed(read.feed)
    expect(issues).toEqual([])
    expect(restored.routes.map((route) => route.code)).toEqual(['5', '9AT'])
    expect(restored.stops.map((stop) => stop.code)).toEqual(['S1', 'S2', 'S3'])
    expect(restored.trips).toHaveLength(2)

    const t2 = restored.trips.find((trip) => trip.id === 'T2')
    expect(t2?.dayType).toBe('sunday')
    expect(t2?.startMinute).toBe(23 * 60 + 30)
    expect(t2?.endMinute).toBe(24 * 60 + 10)
  })

  it('reports missing files instead of throwing', () => {
    const result = readGtfsFiles({})
    expect(result.feed).toBeNull()
    expect(result.issues.map((issue) => issue.file)).toContain(GTFS_FILES.agency)
  })
})

describe('validateGtfsFeed', () => {
  it('catches unknown references and bad sequences', () => {
    const { value: feed } = toGtfsFeed(sampleNetwork())
    const broken = {
      ...feed,
      trips: [
        ...feed.trips,
        { tripId: 'T9', routeId: 'NOPE', serviceId: 'monday' },
        { tripId: 'T10', routeId: '5', serviceId: 'monday' },
      ],
      stopTimes: [
        ...feed.stopTimes,
        { tripId: 'T9', stopId: 'UNKNOWN', arrivalTime: '07:00:00', departureTime: '07:00:00', stopSequence: 1 },
      ],
    }

    const issues = validateGtfsFeed(broken)
    const codes = issues.map((issue) => issue.code)
    expect(codes).toContain('trip-route')
    expect(codes).toContain('stop-time-stop')
    expect(codes).toContain('trip-no-stops')
    expect(hasErrors(issues)).toBe(true)
  })

  it('flags a trip without an active service day', () => {
    const { value: feed } = toGtfsFeed(sampleNetwork())
    const broken = {
      ...feed,
      calendars: feed.calendars.map((calendar) => ({ ...calendar, days: { ...days } })),
    }
    expect(validateGtfsFeed(broken).map((issue) => issue.code)).toContain('service-no-days')
  })
})

describe('spreadStopTimes', () => {
  it('spreads minutes evenly and keeps the endpoints', () => {
    const times = spreadStopTimes(['A', 'B', 'C'], 600, 640)
    expect(times.map((time) => time.arrivalMinute)).toEqual([600, 620, 640])
    expect(times.map((time) => time.sequence)).toEqual([1, 2, 3])
  })

  it('refuses fewer than two stops', () => {
    expect(() => spreadStopTimes(['A'], 600, 620)).toThrow(/two stops/)
  })
})
