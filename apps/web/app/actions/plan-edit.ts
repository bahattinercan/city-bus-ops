'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import {
  cellLabel,
  parseAssistantProposal,
  parseEditText,
  resolveEdits,
  validatePlan,
  type AssistantContext,
  type PlanEdit,
  type PlanSnapshot,
} from '@citybus/domain'
import { routes } from '@citybus/db'
import { isAssistantEnabled, requestEditProposal } from '@/lib/assistant'
import { recordAudit } from '@/lib/audit'
import { writePlanCell } from '@/lib/cell-write'
import { getDb, getOrganisation } from '@/lib/db'
import { loadPlan, mondayOf, saveViolations, standbyRouteIdOf } from '@/lib/plan'
import { dayLabel } from '@/lib/time'

export type ProposalRow = {
  readonly plate: string
  readonly dayIndex: number
  readonly day: string
  readonly before: string
  readonly after: string
  readonly reason?: string
}

export type EditState =
  | { readonly status: 'idle' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'proposal'
      readonly week: string
      readonly source: 'metin' | 'assistant'
      readonly model?: string
      readonly rows: readonly ProposalRow[]
      readonly problems: readonly string[]
      readonly editsJson: string
      readonly instruction: string
    }
  | {
      readonly status: 'applied'
      readonly week: string
      readonly applied: number
      readonly problems: readonly string[]
      readonly hard: number
      readonly soft: number
    }

const RULE_CODES_FOR_PROMPT = [
  'R1',
  'R2',
  'R3',
  'R4',
  'R7',
  'R8',
  'R9',
  'R12',
  'R14',
  'R15',
  'R16',
  'L1',
  'L2',
  'L3',
  'L4',
] as const

function weekFrom(form: FormData): string {
  const value = form.get('week')
  return mondayOf(typeof value === 'string' && value !== '' ? value : new Date().toISOString().slice(0, 10))
}

/** `YAT` is what the operator sees for an empty cell; the diff says the same word. */
function displayCode(code: string): string {
  const trimmed = code.trim()
  return trimmed === '' ? 'YAT' : trimmed
}

function currentCodes(snapshot: PlanSnapshot): Map<string, string> {
  const groups = new Map(snapshot.groups.map((group) => [group.id, group]))
  const routeById = new Map(snapshot.routes.map((route) => [route.id, route]))
  const codes = new Map<string, string>()
  for (const assignment of snapshot.assignments) {
    codes.set(`${assignment.dayIndex}:${assignment.vehicleId}`, cellLabel(assignment, groups, routeById))
  }
  return codes
}

function buildContext(snapshot: PlanSnapshot, routeCodes: readonly string[], week: string): AssistantContext {
  const codes = currentCodes(snapshot)
  return {
    weekStart: week,
    weekOffset: snapshot.weekOffset,
    days: snapshot.days.map((day) => ({ dayIndex: day.dayIndex, label: dayLabel(day.dayType), date: day.date })),
    vehicles: snapshot.vehicles.map((vehicle) => ({ plate: vehicle.plate, status: vehicle.status })),
    routeCodes,
    cells: snapshot.vehicles.map((vehicle) => ({
      plate: vehicle.plate,
      // An idle cell reads as `YAT` on screen but is empty in the sheet; the model gets the sheet.
      codes: snapshot.days.map((day) => {
        const code = codes.get(`${day.dayIndex}:${vehicle.id}`) ?? ''
        return code === 'YAT' ? '' : code
      }),
    })),
    ruleCodes: RULE_CODES_FOR_PROMPT,
  }
}

/**
 * Turns one instruction into a bounded list of cell edits and returns the diff.
 * Nothing is written here: the operator confirms it first.
 *
 * `metin` mode parses the operator's lines deterministically (no model involved);
 * `assistant` mode asks the model for the same `PlanEdit[]` shape and validates every
 * edit against the real vehicles and route codes.
 */
export async function proposeEditsAction(previous: EditState, form: FormData): Promise<EditState> {
  void previous
  const week = weekFrom(form)
  const mode = form.get('mode') === 'assistant' ? 'assistant' : 'metin'
  const organisation = await getOrganisation()
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, week)
  if (plan.version === null) {
    return { status: 'error', message: 'Bu hafta için plan yok. Önce "Haftayı üret" ile planı oluşturun.' }
  }

  const routeRows = await db.select().from(routes).where(eq(routes.organisationId, organisation.id))
  const routeCodes = routeRows.map((row) => row.code)
  const vehicles = plan.snapshot.vehicles.map((vehicle) => ({ id: vehicle.id, plate: vehicle.plate }))

  let edits: readonly PlanEdit[] = []
  const problems: string[] = []
  let model: string | undefined
  const instruction = mode === 'assistant' ? String(form.get('instruction') ?? '').trim() : ''

  if (mode === 'metin') {
    const parsed = parseEditText(String(form.get('lines') ?? ''))
    edits = parsed.edits
    problems.push(...parsed.errors.map((error) => `${error.line} → ${error.reason}`))
    if (edits.length === 0 && problems.length === 0) {
      return { status: 'error', message: 'Düzenlenecek satır yok. "plaka gün kod" biçiminde yazın.' }
    }
  } else {
    if (instruction === '') {
      return { status: 'error', message: 'İstek boş. Ne değiştirmek istediğinizi yazın.' }
    }
    if (!isAssistantEnabled()) {
      return { status: 'error', message: 'AI önerisi kapalı. ASSISTANT_ENABLED ve ASSISTANT_API_KEY tanımlanmalı.' }
    }

    const answer = await requestEditProposal(buildContext(plan.snapshot, routeCodes, week), instruction)
    if (!answer.ok) {
      return { status: 'error', message: answer.message }
    }
    edits = answer.answer.edits
    problems.push(...answer.answer.problems)
    model = answer.answer.model
  }

  const resolution = resolveEdits(edits, { vehicles, routeCodes })
  const codes = currentCodes(plan.snapshot)
  const dayByIndex = new Map(plan.snapshot.days.map((day) => [day.dayIndex, dayLabel(day.dayType)]))

  const rows: ProposalRow[] = resolution.resolved.map((row) => ({
    plate: row.edit.plate,
    dayIndex: row.edit.dayIndex,
    day: dayByIndex.get(row.edit.dayIndex) ?? String(row.edit.dayIndex),
    before: codes.get(`${row.edit.dayIndex}:${row.vehicleId}`) ?? '—',
    after: displayCode(row.edit.code),
    ...(row.edit.reason === undefined ? {} : { reason: row.edit.reason }),
  }))

  problems.push(...resolution.rejected.map((row) => `${row.edit.plate} ${row.edit.dayIndex} → ${row.reason}`))

  if (rows.length === 0) {
    return { status: 'error', message: 'Öneri uygulanabilir hücre içermiyor.' }
  }

  return {
    status: 'proposal',
    week,
    source: mode,
    ...(model === undefined ? {} : { model }),
    rows,
    problems,
    editsJson: JSON.stringify(resolution.resolved.map((row) => row.edit)),
    instruction,
  }
}

/** Writes the confirmed proposal through the same cell writer the manual editor uses. */
export async function applyProposalAction(previous: EditState, form: FormData): Promise<EditState> {
  void previous
  const week = weekFrom(form)
  const source = form.get('source') === 'assistant' ? 'assistant' : 'metin'
  const instruction = String(form.get('instruction') ?? '')
  const model = String(form.get('model') ?? '')

  const organisation = await getOrganisation()
  const db = getDb()

  const plan = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, week)
  if (plan.version === null) {
    return { status: 'error', message: 'Bu hafta için plan yok.' }
  }

  // The echoed proposal is re-validated: it is never trusted because it came back.
  const parsed = parseAssistantProposal(String(form.get('edits') ?? ''))
  const routeRows = await db.select().from(routes).where(eq(routes.organisationId, organisation.id))
  const routeIdByCode = new Map(routeRows.map((row) => [row.code, row.id]))
  const standbyRouteId = standbyRouteIdOf(plan.snapshot)
  const resolution = resolveEdits(parsed.edits, {
    vehicles: plan.snapshot.vehicles.map((vehicle) => ({ id: vehicle.id, plate: vehicle.plate })),
    routeCodes: routeRows.map((row) => row.code),
  })

  const failures = [
    ...parsed.problems,
    ...resolution.rejected.map((row) => `${row.edit.plate} → ${row.reason}`),
  ]
  let applied = 0

  for (const row of resolution.resolved) {
    const outcome = await writePlanCell(db, {
      planVersionId: plan.version.id,
      vehicleId: row.vehicleId,
      dayIndex: row.edit.dayIndex,
      rawCode: row.edit.code,
      routeIdByCode,
      standbyRouteId,
    })
    if (outcome.ok) {
      applied += 1
    } else {
      failures.push(`${row.edit.plate} ${row.edit.dayIndex} → ${outcome.reason}`)
    }
  }

  const refreshed = await loadPlan(db, organisation.id, organisation.rotationAnchorWeek, week)
  const violations = validatePlan(refreshed.snapshot)
  await saveViolations(db, plan.version.id, violations)
  const hard = violations.filter((violation) => violation.severity === 'hard').length

  await recordAudit(db, {
    organisationId: organisation.id,
    actorUserId: null,
    action: source === 'assistant' ? 'plan.bulk_edit.assistant' : 'plan.bulk_edit',
    entity: 'plan_version',
    entityId: plan.version.id,
    payload: {
      weekStart: week,
      applied,
      failures,
      instruction: instruction === '' ? null : instruction,
      model: model === '' ? null : model,
      edits: resolution.resolved.map((row) => ({
        plate: row.edit.plate,
        dayIndex: row.edit.dayIndex,
        code: row.edit.code,
      })),
    },
  })

  revalidatePath('/plan')

  return { status: 'applied', week, applied, problems: failures, hard, soft: violations.length - hard }
}
