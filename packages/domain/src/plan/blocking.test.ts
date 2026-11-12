import { describe, expect, it } from 'vitest'
import { blockTrips, blockWindow, type BlockableTrip } from './blocking'

const trips: BlockableTrip[] = [
  { id: 'T1', startMinute: 360, endMinute: 400 },
  { id: 'T2', startMinute: 420, endMinute: 460 },
  { id: 'T3', startMinute: 480, endMinute: 520 },
  { id: 'T4', startMinute: 540, endMinute: 580 },
]

describe('blockTrips', () => {
  it('chains every trip on one vehicle when the schedule allows', () => {
    const result = blockTrips(trips, ['v1'])
    expect(result.unassignedTripIds).toEqual([])
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0]?.tripIds).toEqual(['T1', 'T2', 'T3', 'T4'])
  })

  it('splits work between vehicles when departures overlap', () => {
    const overlapping: BlockableTrip[] = [
      { id: 'A', startMinute: 360, endMinute: 420 },
      { id: 'B', startMinute: 370, endMinute: 430 },
      { id: 'C', startMinute: 380, endMinute: 440 },
    ]
    const result = blockTrips(overlapping, ['v1', 'v2'])
    expect(result.unassignedTripIds).toEqual(['C'])
    expect(result.notices[0]).toContain('1 sefer atanamadı')
  })

  it('respects the layover between trips', () => {
    const tight: BlockableTrip[] = [
      { id: 'A', startMinute: 360, endMinute: 400 },
      { id: 'B', startMinute: 405, endMinute: 445 },
    ]
    expect(blockTrips(tight, ['v1'], { minLayoverMinutes: 10 }).unassignedTripIds).toEqual(['B'])
    expect(blockTrips(tight, ['v1'], { minLayoverMinutes: 5 }).unassignedTripIds).toEqual([])
  })

  it('is deterministic and independent of input order', () => {
    const shuffled = [trips[2]!, trips[0]!, trips[3]!, trips[1]!]
    const a = blockTrips(trips, ['v1', 'v2'])
    const b = blockTrips(shuffled, ['v1', 'v2'])
    expect(a.blocks).toEqual(b.blocks)
  })

  it('drops vehicles that received no trip', () => {
    const result = blockTrips(trips.slice(0, 1), ['v1', 'v2'])
    expect(result.blocks).toHaveLength(1)
  })
})

describe('blockWindow', () => {
  it('returns the first departure, last arrival and driving time', () => {
    const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
    const window = blockWindow({ vehicleId: 'v1', tripIds: ['T1', 'T3'] }, tripsById)
    expect(window).toEqual({ startMinute: 360, endMinute: 520, drivingMinutes: 80 })
  })

  it('returns null for an empty block', () => {
    expect(blockWindow({ vehicleId: 'v1', tripIds: [] }, new Map())).toBeNull()
  })
})
