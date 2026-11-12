/**
 * Vehicle blocking (legacy M3): chain a route's trips into per-vehicle blocks.
 *
 * Greedy, deterministic and explainable: trips are taken in start order and given to the
 * vehicle that has been idle longest but can still make the departure after the layover.
 * A trip that cannot be covered stays unassigned and is reported — silently dropping a trip
 * would leave a hole in the service without telling anyone.
 */
export type BlockableTrip = {
  readonly id: string
  readonly startMinute: number
  readonly endMinute: number
}

export type TripBlock = {
  readonly vehicleId: string
  readonly tripIds: readonly string[]
}

export type BlockingOptions = {
  /** Minimum time between the end of one trip and the start of the next. */
  readonly minLayoverMinutes?: number
  /** A block may not grow past this span; a longer day is split between vehicles. */
  readonly maxBlockMinutes?: number
}

export type BlockingResult = {
  readonly blocks: readonly TripBlock[]
  readonly unassignedTripIds: readonly string[]
  readonly notices: readonly string[]
}

export function blockTrips(
  trips: readonly BlockableTrip[],
  vehicleIds: readonly string[],
  options: BlockingOptions = {},
): BlockingResult {
  const layover = options.minLayoverMinutes ?? 10
  const maxBlock = options.maxBlockMinutes ?? 8 * 60
  const firstStart = new Map<string, number>()
  const assigned = new Map<string, string[]>()
  const lastEnd = new Map<string, number>()
  const unassigned: string[] = []
  const notices: string[] = []

  for (const vehicleId of vehicleIds) {
    assigned.set(vehicleId, [])
  }

  const ordered = [...trips].sort(
    (a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id),
  )

  for (const trip of ordered) {
    // Feasible = can reach this departure in time and the block would stay inside its span.
    const candidates = vehicleIds.filter((vehicleId) => {
      const end = lastEnd.get(vehicleId)
      if (end === undefined) return true
      if (end + layover > trip.startMinute) return false
      const start = firstStart.get(vehicleId) ?? trip.startMinute
      return trip.endMinute - start <= maxBlock
    })

    if (candidates.length === 0) {
      unassigned.push(trip.id)
      continue
    }

    // Compact chaining: the vehicle that finished last takes the next departure, which keeps
    // blocks contiguous instead of spreading one route over the whole fleet.
    const chosen = candidates.sort((a, b) => {
      const endDiff = (lastEnd.get(b) ?? -1) - (lastEnd.get(a) ?? -1)
      return endDiff !== 0 ? endDiff : a.localeCompare(b)
    })[0]

    if (chosen === undefined) {
      unassigned.push(trip.id)
      continue
    }

    assigned.get(chosen)?.push(trip.id)
    lastEnd.set(chosen, trip.endMinute)
    if (!firstStart.has(chosen)) firstStart.set(chosen, trip.startMinute)
  }

  if (unassigned.length > 0) {
    notices.push(
      `${unassigned.length} sefer atanamadı: ${unassigned.slice(0, 5).join(', ')}${unassigned.length > 5 ? '…' : ''}`,
    )
  }

  const blocks = vehicleIds
    .map((vehicleId) => ({ vehicleId, tripIds: assigned.get(vehicleId) ?? [] }))
    .filter((block) => block.tripIds.length > 0)

  return { blocks, unassignedTripIds: unassigned, notices }
}

/** Duty window of a block: first departure to last arrival. */
export function blockWindow(
  block: TripBlock,
  tripsById: ReadonlyMap<string, BlockableTrip>,
): { startMinute: number; endMinute: number; drivingMinutes: number } | null {
  const trips = block.tripIds.flatMap((tripId) => {
    const trip = tripsById.get(tripId)
    return trip === undefined ? [] : [trip]
  })
  if (trips.length === 0) return null

  return {
    startMinute: Math.min(...trips.map((trip) => trip.startMinute)),
    endMinute: Math.max(...trips.map((trip) => trip.endMinute)),
    drivingMinutes: trips.reduce((sum, trip) => sum + (trip.endMinute - trip.startMinute), 0),
  }
}
