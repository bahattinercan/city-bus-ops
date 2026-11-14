# Planning assistant (bulk cell editing)

One Turkish sentence — or a few operator lines — becomes a bounded list of plan-cell edits.
The assistant never writes anything by itself and never touches the Excel export.

## Why not edit the `.xlsx`

GTFS, TODS and the printed sheet are **generated exports** (`docs/02-data-model.md`). A file-level
edit would be overwritten by the next export, would never reach the rule engine, and would bypass
the 7-week rotation law. So the assistant edits *cells* — the same rows the manual editor writes —
and re-renders the sheet from them.

## Flow

```
operator lines ─┐
                ├─> PlanEdit[] ─> resolveEdits (vehicles, route codes) ─> diff table ─> onay
one sentence ───┘        │                     │
   (model)               │                     └─ rejects unknown plate / route / code, caps at 20
                         └─ parseEditText (deterministic) | parseAssistantProposal (model answer)
                                                                        │
onay ──> writePlanCell (lock + standby day scoped) ──> validatePlan ──> audit `plan.bulk_edit*`
```

| Layer | Where | Pure? |
| --- | --- | --- |
| Cell grammar | `packages/domain/src/sheet-cell.ts` (`parseSheetCell`) | yes |
| Line parser, resolution, limits | `packages/domain/src/plan-edit.ts` | yes |
| Prompt + answer contract | `packages/domain/src/assistant.ts` | yes |
| Provider call | `apps/web/lib/assistant.ts` | no (HTTP) |
| Write path | `apps/web/lib/cell-write.ts` | no (DB) |
| Server actions | `apps/web/app/actions/plan-edit.ts` | no |
| UI | `apps/web/app/plan/edit-panel.tsx` | client component |

## Operator syntax (no model needed)

```
003 cuma 9A      # 003, Friday, route 9A duty
030 pzt -20      # extra duty on route 20
042 cmt x        # standby
050 pazar YAT    # explicit idle row
060 sal          # no code -> cell cleared (YAT)
```

Day tokens: `pazartesi…pazar`, `pzt sal car per cum cmt paz`, ASCII spellings, or `1…7`.
Unknown lines are reported with the reason; nothing is guessed.

## What the model may and may not do

| Allowed | Forbidden |
| --- | --- |
| Produce up to 20 `{plate, dayIndex, code, reason}` edits | Publish a plan, change rules, invent route codes |
| Explain or rephrase the request | Emit a cell shape outside the closed grammar |
| Return `{"edits": []}` when unsure | Rewrite the whole week |

Guardrails that are enforced in code, not in the prompt:

1. Every edit is re-resolved against real vehicles and route codes before it is applied —
   an echoed proposal is re-validated, never trusted.
2. `MAX_EDITS_PER_REQUEST` (20) caps a single request; a longer model answer is truncated and
   reported.
3. `validatePlan` runs after the write and the violations are saved with the plan version.
4. Each write is audited (`plan.bulk_edit` / `plan.bulk_edit.assistant`) with the instruction,
   the model id and the exact edits — the answer is reproducible from the trail.
5. Written cells are `locked` (R8): regeneration cannot silently undo a confirmed edit.
6. The provider call is time-boxed (20 s) and feature-flagged; a failure returns a message and
   writes nothing.

## Configuration

`.env` (never committed):

```bash
ASSISTANT_ENABLED="true"
ASSISTANT_BASE_URL="https://api.openai.com/v1"   # any OpenAI-compatible endpoint
ASSISTANT_API_KEY=""
ASSISTANT_MODEL="glm-5.3-flash"
# optional: gateways that route on a session/client header
ASSISTANT_HEADERS={"x-opencode-client":"pi","x-opencode-session":"<uuid>"}
```

The request is a plain `POST {base}/chat/completions` (`temperature: 0`, `response_format:
json_object`), so any OpenAI-compatible endpoint works. Measured on the worked example
("cumartesi 003'ü nöbete al, pazar 030'u 9A'ya ver"): `glm-5.3-flash` ≈1.8 s and both edits
correct; `deepseek-v4.1-flash` ≈5.3 s with the same answer. The model only shapes the sentence —
speed matters more than depth here, so a flash model is the default.

With `ASSISTANT_ENABLED` unset the panel shows only the deterministic line editor: no request
leaves the server, and the syntax above still works. The key lives in the gitignored `.env`,
never in the repo, the docs or a log line — and it must be **your own** key, not a personal
credential borrowed from another tool.

## Free provider (worked configuration)

The panel needs ~1 request per instruction and a small prompt (45 vehicles × 7 cells ≈ 2 K
tokens), so a free tier is enough. Any OpenAI-compatible endpoint works; these three were
checked against the provider docs in November 2026:

| Provider | `ASSISTANT_BASE_URL` | `ASSISTANT_MODEL` | Free limits | Signup |
| --- | --- | --- | --- | --- |
| **Groq** (default) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-120b` | 30 req/min · 1 000 req/day · 8 K tokens/min | console.groq.com → API Keys, no card |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-3.5-flash-lite` | per-model RPD (≈500/day), 1 M context | aistudio.google.com/apikey, no card |
| OpenRouter | `https://openrouter.ai/api/v1` | `openrouter/free` | 20 req/min · 50 req/day (1 000 after $10) | openrouter.ai/keys, no card |

Groq is the default because it answers in well under a second at temperature 0, honours
`response_format: json_object`, and states it does **not** train on prompts. Google's free tier
may train on prompts outside EU/UK/EEA — for operator data that is a KVKK decision, so it is not
the default. Model ids drift; if a call fails with "model not found", check the provider console
and only the `ASSISTANT_MODEL` line changes.

Paste the key and flip the switch:

```bash
# .env
ASSISTANT_ENABLED="true"
ASSISTANT_API_KEY="<your free key>"
```

Smoke test before opening the panel (should print `{"edits":[]}`-shaped JSON):

```bash
curl -s "$ASSISTANT_BASE_URL/chat/completions"   -H "authorization: Bearer $ASSISTANT_API_KEY" -H "content-type: application/json"   -d '{"model":"'"$ASSISTANT_MODEL"'","response_format":{"type":"json_object"},"messages":[
       {"role":"system","content":"Return only JSON."},
       {"role":"user","content":"return {\"edits\":[]}"}]}'
```

Written cells carry what the rule engine needs: a standby row gets the week's standby route
(otherwise R9 rejects it as "standby code not in the route dictionary"), so the panel cannot
manufacture a hard violation on its own. Driver names are not part of the prompt
today; if a future instruction needs them, add them to `AssistantContext` deliberately, not by
dumping the roster into the prompt.
