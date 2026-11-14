import type { DayIndex } from './rotation'
import { MAX_EDITS_PER_REQUEST, parseEditDay, type PlanEdit } from './plan-edit'

/**
 * Contract between the app and a language model: what goes in, what may come out.
 *
 * The model is never asked to judge the plan or to publish anything — it turns one Turkish
 * sentence into a bounded list of cell edits. Everything else (validation, locking, the
 * rule engine, the audit trail) stays in our code, which is why a model outage or a bad
 * answer can never corrupt a published week.
 */
export type AssistantCellRow = {
  readonly plate: string
  /** Seven cell texts, Monday first, as printed on the sheet. */
  readonly codes: readonly string[]
}

export type AssistantContext = {
  readonly weekStart: string
  readonly weekOffset: number
  readonly days: readonly { readonly dayIndex: DayIndex; readonly label: string; readonly date: string }[]
  readonly vehicles: readonly { readonly plate: string; readonly status: string }[]
  readonly routeCodes: readonly string[]
  readonly cells: readonly AssistantCellRow[]
  readonly ruleCodes: readonly string[]
}

export type AssistantPrompt = { readonly system: string; readonly user: string }

const CELL_GRAMMAR = [
  '9A   -> o aracın o gün 9A hattı görevi',
  '-20  -> 20 hattında ek görev',
  'x    -> nöbet (yedek)',
  '12.00 -> o gün ilk sefer saati',
  'YAT  -> yatan araç (açık kayıt, görev yok)',
  'boş  -> kayıt yok',
].join('\n')

/** Deterministic, compact and stable: same week in, same prompt text out. */
export function buildAssistantPrompt(context: AssistantContext, instruction: string): AssistantPrompt {
  const dayLine = context.days
    .map((day) => `${day.dayIndex}=${day.label} ${day.date.slice(5)}`)
    .join(' · ')

  const planLines = context.cells
    .map((row) => `${row.plate}: ${row.codes.map((code) => (code === '' ? '·' : code)).join(' | ')}`)
    .join('\n')

  const system = [
    'Sen bir şehir içi otobüs operasyon sisteminin plan yardımcısısın.',
    'Görevin: operatörün Türkçe cümlesini, haftalık plan tablosunda SINIRLI sayıda hücre değişikliğine çevirmek.',
    '',
    'Kurallar:',
    `- En fazla ${MAX_EDITS_PER_REQUEST} hücre değiştir. Daha fazlası gerekiyorsa isteği daralt.`,
    '- Yalnızca verilen plakaları, günleri ve hat kodlarını kullan; yeni kod uydurma.',
    '- Hücre kodları şu dilbilgisindedir:',
    CELL_GRAMMAR,
    '- Planı yayınlamazsın, kural motorunu değiştirmezsin: yalnızca hücre önerisi üretirsin.',
    '- Bileşik istekte her etkilenen hücre için AYRI düzenleme üret (iki araç iki düzenleme).',
    '- Emin değilsen o hücreyi hiç önerme.',
    '',
    'Yanıt biçimi: yalnızca JSON. Başka metin yazma.',
    '{"edits":[{"plate":"003","dayIndex":5,"code":"9A","reason":"kısa Türkçe gerekçe"}]}',
    'dayIndex 1=pazartesi ... 7=pazar. Değişiklik yoksa {"edits":[]} döndür.',
  ].join('\n')

  const user = [
    `Hafta: ${context.weekStart} (rotasyon konumu ${context.weekOffset}/7)`,
    `Günler: ${dayLine}`,
    `Hat kodları: ${context.routeCodes.join(', ')}`,
    `Kural kodları: ${context.ruleCodes.join(', ')}`,
    '',
    'Araçlar ve bu haftaki hücreleri (pazartesi→pazar):',
    planLines,
    '',
    `İstek: ${instruction.trim()}`,
  ].join('\n')

  return { system, user }
}

export type AssistantProposal = {
  readonly edits: readonly PlanEdit[]
  readonly problems: readonly string[]
}

type LooseEdit = { plate?: unknown; dayIndex?: unknown; day?: unknown; code?: unknown; reason?: unknown }

/** Never throws: a hallucinated answer becomes a list of problems the UI can show. */
export function parseAssistantProposal(raw: string): AssistantProposal {
  const edits: PlanEdit[] = []
  const problems: string[] = []

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return { edits, problems: ['yanıt JSON değil'] }
  }

  const list = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { edits?: unknown }).edits)
      ? (payload as { edits: unknown[] }).edits
      : undefined

  if (list === undefined) {
    return { edits, problems: ['yanıtta "edits" dizisi yok'] }
  }

  if (list.length > MAX_EDITS_PER_REQUEST) {
    problems.push(`öneri ${list.length} hücre içeriyor; en fazla ${MAX_EDITS_PER_REQUEST} kabul edilir`)
  }

  list.slice(0, MAX_EDITS_PER_REQUEST).forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      problems.push(`${index + 1}. öneri nesne değil`)
      return
    }

    const candidate = item as LooseEdit
    const plate = typeof candidate.plate === 'string' ? candidate.plate.trim() : ''
    if (plate === '') {
      problems.push(`${index + 1}. öneride plaka yok`)
      return
    }

    const day = resolveDay(candidate)
    if (day === undefined) {
      problems.push(`${index + 1}. öneride gün anlaşılmadı`)
      return
    }

    if (typeof candidate.code !== 'string') {
      problems.push(`${index + 1}. öneride kod yok`)
      return
    }

    const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : undefined
    edits.push({
      plate,
      dayIndex: day,
      code: candidate.code.trim(),
      ...(reason === undefined || reason === '' ? {} : { reason }),
    })
  })

  return { edits, problems }
}

function resolveDay(candidate: LooseEdit): DayIndex | undefined {
  if (typeof candidate.dayIndex === 'number') {
    return Number.isInteger(candidate.dayIndex) && candidate.dayIndex >= 1 && candidate.dayIndex <= 7
      ? (candidate.dayIndex as DayIndex)
      : undefined
  }
  if (typeof candidate.dayIndex === 'string') {
    return parseEditDay(candidate.dayIndex)
  }
  if (typeof candidate.day === 'string') {
    return parseEditDay(candidate.day)
  }
  return undefined
}
