'use client'

import { useActionState, useState } from 'react'
import { errorText, format, type Messages } from '@/lib/i18n/text'
import { applyProposalAction, proposeEditsAction, type EditState } from '../actions/plan-edit'

const IDLE: EditState = { status: 'idle' }

const PLACEHOLDER = `003 cuma 9A
030 pzt -20
042 cmt x
050 pazar YAT
060 sal`

export function EditPanel({
  week,
  assistantEnabled,
  messages,
}: {
  week: string
  assistantEnabled: boolean
  messages: Messages
}) {
  const [proposal, propose, proposing] = useActionState(proposeEditsAction, IDLE)
  const [result, apply, applying] = useActionState(applyProposalAction, IDLE)
  // Controlled so the operator still sees what they typed after the server round trip.
  const [lines, setLines] = useState('')
  const [instruction, setInstruction] = useState('')
  const copy = messages.editPanel

  return (
    <div className="edit-panel">
      <p className="hint">{copy.hint}</p>

      <form action={propose} className="edit-form">
        <input type="hidden" name="week" value={week} />
        <input type="hidden" name="mode" value="metin" />
        <label className="field">
          {copy.lines}
          <textarea
            name="lines"
            rows={4}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            value={lines}
            onChange={(event) => setLines(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className={proposal.status === 'proposal' ? 'secondary' : undefined}
          disabled={proposing}
        >
          {proposing ? copy.previewing : copy.preview}
        </button>
      </form>

      <div className="edit-ai">
        {assistantEnabled && (
          <form action={propose} className="edit-form">
            <input type="hidden" name="week" value={week} />
            <input type="hidden" name="mode" value="assistant" />
            <label className="field">
              {copy.aiTry}
              <input
                name="instruction"
                placeholder={copy.aiPlaceholder}
                autoComplete="off"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
              />
            </label>
            <button type="submit" className="secondary" disabled={proposing}>
              {proposing ? copy.aiThinking : copy.aiPropose}
            </button>
          </form>
        )}

        {!assistantEnabled && <p className="hint">{copy.aiDisabled}</p>}
      </div>

      {proposal.status === 'error' && (
        <div className="notice error">
          {errorText(messages, proposal.messageKey ?? '') ?? proposal.message}
        </div>
      )}

      {proposal.status === 'proposal' && (
        <div className="proposal">
          <div className="proposal-head">
            <span className="badge">{format(copy.cellCount, { count: proposal.rows.length })}</span>
            <span className="badge">
              {proposal.source === 'assistant'
                ? `AI${proposal.model === undefined ? '' : ` · ${proposal.model}`}`
                : copy.sourceText}
            </span>
            <span className="muted">
              {copy.waiting} · {proposal.week}
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th>{messages.common.plate}</th>
                <th>{messages.common.day}</th>
                <th>{copy.before}</th>
                <th>{copy.after}</th>
                <th>{copy.reason}</th>
              </tr>
            </thead>
            <tbody>
              {proposal.rows.map((row) => (
                <tr key={`${row.plate}-${row.dayIndex}`}>
                  <td>{row.plate}</td>
                  <td className="muted">{row.day}</td>
                  <td className="muted">{row.before}</td>
                  <td>
                    <strong>{row.after}</strong>
                  </td>
                  <td className="muted">{row.reason ?? messages.common.none}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {proposal.problems.length > 0 && (
            <div className="notice warn">
              {format(copy.notApplied, { count: proposal.problems.length })}
              <ul>
                {proposal.problems.map((problem) => (
                  <li key={problem.text}>
                    {errorText(messages, problem.code ?? '', problem.params) ?? problem.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form action={apply} className="edit-form">
            <input type="hidden" name="week" value={proposal.week} />
            <input type="hidden" name="edits" value={proposal.editsJson} />
            <input type="hidden" name="source" value={proposal.source} />
            <input type="hidden" name="instruction" value={proposal.instruction} />
            <input type="hidden" name="model" value={proposal.model ?? ''} />
            <button type="submit" disabled={applying}>
              {applying ? copy.applying : format(copy.apply, { count: proposal.rows.length })}
            </button>
          </form>
        </div>
      )}

      {result.status === 'error' && (
        <div className="notice error">
          {errorText(messages, result.messageKey ?? '') ?? result.message}
        </div>
      )}

      {result.status === 'applied' && (
        <div className="notice">
          {format(copy.applied, { count: result.applied, hard: result.hard, soft: result.soft })}
          {result.problems.length > 0 && (
            <ul>
              {result.problems.map((problem) => (
                <li key={problem.text}>
                  {errorText(messages, problem.code ?? '', problem.params) ?? problem.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
