import type { createDb } from './client'
import { depots, dutyGroups, organisations, routes, vehicles } from './schema'

/**
 * Reference data for the Kütahya fleet, taken verbatim from the legacy analysis
 * (`docs/legacy-domain-analysis.md` §5 and §6.1):
 *
 * - 45 fleet numbers: 41 printed on the sheet plus 134/186/225/229 written by hand (O5)
 * - 12 route codes that the legacy analysis could confirm as routes
 * - 4 duty groups with their anchor weekday (`g0`) for the 7-week rotation law
 *
 * Route names are intentionally left equal to the code: no source documented them, and
 * inventing a name would make the data look authoritative when it is not.
 */
const PRINTED_PLATES = [
  '003', '030', '042', '050', '053', '060', '080', '085', '086', '100',
  '125', '128', '129', '130', '146', '147', '153', '159', '160', '166',
  '176', '184', '188', '190', '198', '200', '203', '205', '208', '221',
  '226', '235', '251', '253', '260', '271', '272', '277', '284', '285', '286',
] as const

const HANDWRITTEN_PLATES = ['134', '186', '225', '229'] as const

const ROUTE_CODES = [
  '7A', '8A', '9A', '9AT', '10A', '12A', '26A', '26B', '26E', '27A', '27B', '27E',
] as const

const DUTY_GROUPS = [
  { code: 'TOKI', name: '(6) Toki', vehicleCount: 6, referenceDayIndex: 3 },
  { code: 'SELEBI', name: '(2) F.Şelebi', vehicleCount: 2, referenceDayIndex: 6 },
  { code: 'CUKUR', name: '(5) B.Çukur', vehicleCount: 5, referenceDayIndex: 1 },
  { code: 'KAMPUS', name: '(1) Kampüs/Konya', vehicleCount: 1, referenceDayIndex: 5 },
] as const

export const SEED_SUMMARY = {
  organisationSlug: 'kutahya',
  /** 41 printed + 4 handwritten fleet numbers. */
  vehicleCount: PRINTED_PLATES.length + HANDWRITTEN_PLATES.length,
  routeCount: ROUTE_CODES.length,
  dutyGroupCount: DUTY_GROUPS.length,
} as const

export async function seedReferenceData(handle: ReturnType<typeof createDb>) {
  const { db } = handle

  const [organisation] = await db
    .insert(organisations)
    .values({
      slug: SEED_SUMMARY.organisationSlug,
      name: 'Kütahya Şehir İçi Ulaşım',
      rotationAnchorWeek: '2026-09-21',
    })
    .onConflictDoUpdate({
      target: organisations.slug,
      set: { name: 'Kütahya Şehir İçi Ulaşım', rotationAnchorWeek: '2026-09-21' },
    })
    .returning()

  if (organisation === undefined) {
    throw new Error('Seed failed: organisation was not returned')
  }

  const organisationId = organisation.id

  await db
    .insert(depots)
    .values({ organisationId, code: 'MERKEZ', name: 'Merkez Garaj' })
    .onConflictDoNothing()

  await db
    .insert(vehicles)
    .values([
      ...PRINTED_PLATES.map((plateNumber) => ({
        organisationId,
        plateNumber,
        source: 'printed' as const,
        capacity: 90,
        lowFloor: false,
        airConditioned: true,
      })),
      ...HANDWRITTEN_PLATES.map((plateNumber) => ({
        organisationId,
        plateNumber,
        source: 'handwritten' as const,
        capacity: 90,
        lowFloor: false,
        airConditioned: true,
      })),
    ])
    .onConflictDoNothing()

  await db
    .insert(routes)
    .values(ROUTE_CODES.map((code) => ({ organisationId, code, name: code })))
    .onConflictDoNothing()

  await db
    .insert(dutyGroups)
    .values(DUTY_GROUPS.map((group) => ({ organisationId, ...group })))
    .onConflictDoNothing()

  return { organisationId }
}
