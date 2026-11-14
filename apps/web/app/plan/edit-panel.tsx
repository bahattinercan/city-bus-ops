'use client'

import { useActionState, useState } from 'react'
import { applyProposalAction, proposeEditsAction, type EditState } from '../actions/plan-edit'

const IDLE: EditState = { status: 'idle' }

const PLACEHOLDER = `003 cuma 9A
030 pzt -20
042 cmt x
050 pazar YAT
060 sal`

export function EditPanel({ week, assistantEnabled }: { week: string; assistantEnabled: boolean }) {
  const [proposal, propose, proposing] = useActionState(proposeEditsAction, IDLE)
  const [result, apply, applying] = useActionState(applyProposalAction, IDLE)
  // Controlled so the operator still sees what they typed after the server round trip.
  const [lines, setLines] = useState('')
  const [instruction, setInstruction] = useState('')

  return (
    <div className="edit-panel">
      <p className="hint">
        Bir satır bir hücre: <code>plaka gün kod</code>. Kod boş bırakılırsa hücre temizlenir (YAT).
        Hiçbir şey önizlemeyi onaylamadan yazılmaz; yazılan hücreler elle düzenlenmiş gibi kilitlenir.
      </p>

      <form action={propose} className="edit-form">
        <input type="hidden" name="week" value={week} />
        <input type="hidden" name="mode" value="metin" />
        <label className="field">
          Satırlar
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
          {proposing ? 'Çözümleniyor…' : 'Önizle'}
        </button>
      </form>

      <div className="edit-ai">
        {assistantEnabled && (
        <form action={propose} className="edit-form">
          <input type="hidden" name="week" value={week} />
          <input type="hidden" name="mode" value="assistant" />
          <label className="field">
            AI ile dene
            <input
              name="instruction"
              placeholder="cumartesi 003 ve 030 aracını nöbete al"
              autoComplete="off"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
          </label>
          <button type="submit" className="secondary" disabled={proposing}>
            {proposing ? 'Düşünüyor…' : 'Öneri al'}
          </button>
        </form>
      )}

        {!assistantEnabled && (
          <p className="hint">
            AI önerisi kapalı. Açmak için <code>ASSISTANT_ENABLED=true</code> ve{' '}
            <code>ASSISTANT_API_KEY</code> tanımlayın; metin satırları anahtar olmadan da çalışır.
          </p>
        )}
      </div>

      {proposal.status === 'error' && <div className="notice error">{proposal.message}</div>}

      {proposal.status === 'proposal' && (
        <div className="proposal">
          <div className="proposal-head">
            <span className="badge">{proposal.rows.length} hücre</span>
            <span className="badge">
              {proposal.source === 'assistant' ? `AI${proposal.model === undefined ? '' : ` · ${proposal.model}`}` : 'metin'}
            </span>
            <span className="muted">onay bekliyor · {proposal.week}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Plaka</th>
                <th>Gün</th>
                <th>Önce</th>
                <th>Sonra</th>
                <th>Gerekçe</th>
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
                  <td className="muted">{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {proposal.problems.length > 0 && (
            <div className="notice warn">
              {proposal.problems.length} satır uygulanmayacak:
              <ul>
                {proposal.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
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
              {applying ? 'Yazılıyor…' : `Uygula (${proposal.rows.length} hücre)`}
            </button>
          </form>
        </div>
      )}

      {result.status === 'error' && <div className="notice error">{result.message}</div>}

      {result.status === 'applied' && (
        <div className="notice">
          {result.applied} hücre yazıldı ve kilitlendi · kural denetimi: {result.hard} sert / {result.soft}{' '}
          yumuşak
          {result.problems.length > 0 && (
            <ul>
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
