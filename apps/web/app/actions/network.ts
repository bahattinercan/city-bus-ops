'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { RouteCode, parseDayLabel, type DayType } from '@citybus/domain'
import { routeStops, routes, stops, tripStopTimes, trips } from '@citybus/db'
import { spreadStopTimes } from '@citybus/gtfs'
import { getDb, getOrganisation } from '@/lib/db'
import { parseClock } from '@/lib/time'

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`)
}

function text(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function createRouteAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const back = '/network'

  let code: string
  try {
    code = RouteCode.parse(text(form, 'code')).value
  } catch (error) {
    fail(back, (error as Error).message)
  }

  const name = text(form, 'name') || code
  const db = getDb()

  const existing = await db
    .select({ id: routes.id })
    .from(routes)
    .where(and(eq(routes.organisationId, organisation.id), eq(routes.code, code)))
    .limit(1)
  if (existing.length > 0) {
    fail(back, `Hat ${code} zaten var.`)
  }

  await db.insert(routes).values({
    organisationId: organisation.id,
    code,
    name,
    requiredLowFloor: form.get('requiredLowFloor') === 'on',
    requiredAc: form.get('requiredAc') === 'on',
  })

  revalidatePath(back)
  revalidatePath('/')
}

export async function createStopAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const back = '/network'
  const code = text(form, 'code')
  const name = text(form, 'name')
  if (code === '' || name === '') {
    fail(back, 'stopRequired')
  }

  const latitude = text(form, 'latitude')
  const longitude = text(form, 'longitude')
  if ((latitude === '') !== (longitude === '')) {
    fail(back, 'Enlem ve boylam birlikte girilmeli.')
  }

  const db = getDb()
  const existing = await db
    .select({ id: stops.id })
    .from(stops)
    .where(and(eq(stops.organisationId, organisation.id), eq(stops.code, code)))
    .limit(1)
  if (existing.length > 0) {
    fail(back, `Durak ${code} zaten var.`)
  }

  await db.insert(stops).values({
    organisationId: organisation.id,
    code,
    name,
    latitude: latitude === '' ? null : latitude,
    longitude: longitude === '' ? null : longitude,
  })

  revalidatePath(back)
  revalidatePath('/')
}

export async function addRouteStopAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const routeCode = text(form, 'routeCode')
  const stopCode = text(form, 'stopCode')
  const back = `/network/${encodeURIComponent(routeCode)}`

  const db = getDb()
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organisationId, organisation.id), eq(routes.code, routeCode)))
    .limit(1)
  if (route === undefined) fail(back, `Hat ${routeCode} bulunamadı.`)

  const [stop] = await db
    .select()
    .from(stops)
    .where(and(eq(stops.organisationId, organisation.id), eq(stops.code, stopCode)))
    .limit(1)
  if (stop === undefined) fail(back, `Durak ${stopCode} bulunamadı.`)

  const existing = await db
    .select({ sequence: routeStops.sequence })
    .from(routeStops)
    .where(eq(routeStops.routeId, route.id))
    .orderBy(asc(routeStops.sequence))

  if (existing.some((row) => row.sequence === Number(form.get('sequence') ?? ''))) {
    fail(back, 'sequenceUsed')
  }

  const nextSequence = (existing.at(-1)?.sequence ?? 0) + 1
  await db.insert(routeStops).values({ routeId: route.id, stopId: stop.id, sequence: nextSequence })

  revalidatePath(back)
}

export async function removeRouteStopAction(form: FormData): Promise<void> {
  const routeCode = text(form, 'routeCode')
  const sequence = Number.parseInt(text(form, 'sequence'), 10)
  const back = `/network/${encodeURIComponent(routeCode)}`

  const db = getDb()
  const [route] = await db.select().from(routes).where(eq(routes.code, routeCode)).limit(1)
  if (route === undefined) fail(back, `Hat ${routeCode} bulunamadı.`)

  await db.delete(routeStops).where(and(eq(routeStops.routeId, route.id), eq(routeStops.sequence, sequence)))

  const remaining = await db
    .select({ id: routeStops.id, sequence: routeStops.sequence })
    .from(routeStops)
    .where(eq(routeStops.routeId, route.id))
    .orderBy(asc(routeStops.sequence))

  for (const [index, row] of remaining.entries()) {
    if (row.sequence !== index + 1) {
      await db.update(routeStops).set({ sequence: index + 1 }).where(eq(routeStops.id, row.id))
    }
  }

  revalidatePath(back)
}

export async function createTripAction(form: FormData): Promise<void> {
  const organisation = await getOrganisation()
  const routeCode = text(form, 'routeCode')
  const back = `/network/${encodeURIComponent(routeCode)}`

  const dayLabel = text(form, 'dayType')
  const dayType: DayType | undefined = parseDayLabel(dayLabel)
  if (dayType === undefined) {
    fail(back, `Gün tipi anlaşılmadı: "${dayLabel}"`)
  }

  let startMinute: number
  let endMinute: number
  try {
    startMinute = parseClock(text(form, 'start'))
    endMinute = parseClock(text(form, 'end'))
  } catch (error) {
    fail(back, (error as Error).message)
  }

  if (endMinute <= startMinute) {
    fail(back, 'tripStartEnd')
  }

  const db = getDb()
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.organisationId, organisation.id), eq(routes.code, routeCode)))
    .limit(1)
  if (route === undefined) fail(back, `Hat ${routeCode} bulunamadı.`)

  const routeStopRows = await db
    .select({ code: stops.code })
    .from(routeStops)
    .innerJoin(stops, eq(stops.id, routeStops.stopId))
    .where(eq(routeStops.routeId, route.id))
    .orderBy(asc(routeStops.sequence))

  if (routeStopRows.length < 2) {
    fail(back, 'twoStopsNeeded')
  }

  const stopCodes = routeStopRows.map((row) => row.code)
  const spread = spreadStopTimes(stopCodes, startMinute, endMinute)

  await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        routeId: route.id,
        dayType: dayType as DayType,
        startMinute,
        endMinute,
        crossesMidnight: endMinute > 1440,
      })
      .returning()

    if (trip === undefined) {
      throw new Error('Sefer kaydı oluşturulamadı')
    }

    const stopRows = await tx
      .select({ id: stops.id, code: stops.code })
      .from(stops)
      .where(eq(stops.organisationId, organisation.id))
    const stopIdByCode = new Map(stopRows.map((row) => [row.code, row.id]))

    await tx.insert(tripStopTimes).values(
      spread.map((stopTime) => {
        const stopId = stopIdByCode.get(stopTime.stopCode)
        if (stopId === undefined) throw new Error(`Durak bulunamadı: ${stopTime.stopCode}`)
        return {
          tripId: trip.id,
          stopId,
          sequence: stopTime.sequence,
          arrivalMinute: stopTime.arrivalMinute,
          departureMinute: stopTime.departureMinute,
        }
      }),
    )
  })

  revalidatePath(back)
  revalidatePath('/')
}

export async function deleteTripAction(form: FormData): Promise<void> {
  const routeCode = text(form, 'routeCode')
  const tripId = text(form, 'tripId')
  const back = `/network/${encodeURIComponent(routeCode)}`

  if (tripId !== '') {
    await getDb().delete(trips).where(eq(trips.id, tripId))
  }

  revalidatePath(back)
  revalidatePath('/')
}
