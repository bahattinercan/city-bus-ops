import { buildAssistantPrompt, parseAssistantProposal, type AssistantContext, type PlanEdit } from '@citybus/domain'

/**
 * Thin provider adapter. The contract (prompt shape, answer parsing, limits) lives in
 * `@citybus/domain`; this file only moves bytes over HTTP, so the feature can be tested
 * without a network and disabled without touching the rest of the app.
 *
 * Environment:
 * - `ASSISTANT_ENABLED=true` turns the panel on
 * - `ASSISTANT_BASE_URL` an OpenAI-compatible base URL (default https://api.openai.com/v1)
 * - `ASSISTANT_API_KEY`  provider key
 * - `ASSISTANT_MODEL`    model id
 * - `ASSISTANT_HEADERS`  optional extra request headers as a JSON object, for gateways that
 *                        route on a session/client header (e.g. `{"x-opencode-session":"…"}`)
 */
export const ASSISTANT_TIMEOUT_MS = 20_000

export type AssistantAnswer = {
  readonly model: string
  readonly edits: readonly PlanEdit[]
  readonly problems: readonly string[]
}

export type AssistantResult = { readonly ok: true; readonly answer: AssistantAnswer } | { readonly ok: false; readonly message: string }

export function isAssistantEnabled(): boolean {
  return process.env.ASSISTANT_ENABLED === 'true' && (process.env.ASSISTANT_API_KEY ?? '').trim() !== ''
}

function baseUrl(): string {
  return (process.env.ASSISTANT_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
}

function modelId(): string {
  return process.env.ASSISTANT_MODEL ?? 'gpt-4o-mini'
}

/** Extra headers, parsed defensively: a broken value must not break the feature. */
export function extraHeaders(): Record<string, string> {
  const raw = (process.env.ASSISTANT_HEADERS ?? '').trim()
  if (raw === '') return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && key.trim() !== '') headers[key.trim()] = value
    }
    return headers
  } catch {
    return {}
  }
}

type ChatCompletion = {
  readonly choices?: readonly { readonly message?: { readonly content?: string | null } }[]
}

export async function requestEditProposal(
  context: AssistantContext,
  instruction: string,
): Promise<AssistantResult> {
  const apiKey = (process.env.ASSISTANT_API_KEY ?? '').trim()
  if (!isAssistantEnabled()) {
    return { ok: false, message: 'Asistan kapalı (ASSISTANT_ENABLED / ASSISTANT_API_KEY tanımlı değil).' }
  }

  const prompt = buildAssistantPrompt(context, instruction)
  const model = modelId()

  let response: Response
  try {
    response = await fetch(`${baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...extraHeaders(),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: AbortSignal.timeout(ASSISTANT_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'bilinmeyen hata'
    return { ok: false, message: `Asistana ulaşılamadı (${reason}). Öneri uygulanmadı.` }
  }

  if (!response.ok) {
    // The provider's own words are the only useful diagnosis; keep it short and secret-free.
    const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
    const suffix = detail === '' ? '' : ` — ${detail}`
    return { ok: false, message: `Asistan yanıtı başarısız (HTTP ${response.status})${suffix}` }
  }

  const payload = (await response.json()) as ChatCompletion
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim() === '') {
    return { ok: false, message: 'Asistan boş yanıt döndü. Öneri uygulanmadı.' }
  }

  const proposal = parseAssistantProposal(content)
  return { ok: true, answer: { model, edits: proposal.edits, problems: proposal.problems } }
}
