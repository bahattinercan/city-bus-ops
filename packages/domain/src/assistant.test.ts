import { describe, expect, it } from 'vitest'
import { buildAssistantPrompt, parseAssistantProposal } from './assistant'
import { MAX_EDITS_PER_REQUEST } from './plan-edit'

const context = {
  weekStart: '2026-11-09',
  weekOffset: 3,
  days: [
    { dayIndex: 1 as const, label: 'Pazartesi', date: '2026-11-09' },
    { dayIndex: 5 as const, label: 'Cuma', date: '2026-11-13' },
  ],
  vehicles: [{ plate: '003', status: 'active' }],
  routeCodes: ['9A', '20'],
  cells: [{ plate: '003', codes: ['9A', '', '', '', 'YAT', '', ''] }],
  ruleCodes: ['R7', 'R14'],
}

describe('buildAssistantPrompt', () => {
  const prompt = buildAssistantPrompt(context, '  cuma 003 aracını 9A yap ')

  it('carries the plan, the days and the closed cell grammar', () => {
    expect(prompt.user).toContain('003: 9A | · | · | · | YAT | · | ·')
    expect(prompt.user).toContain('1=Pazartesi 11-09')
    expect(prompt.user).toContain('Hat kodları: 9A, 20')
    expect(prompt.system).toContain('12.00 -> o gün ilk sefer saati')
  })

  it('states the edit limit and forbids publishing', () => {
    expect(prompt.system).toContain(`En fazla ${MAX_EDITS_PER_REQUEST} hücre`)
    expect(prompt.system).toContain('Planı yayınlamazsın')
    expect(prompt.system).toContain('{"edits"')
  })

  it('demands one edit per affected cell for compound instructions', () => {
    expect(prompt.system).toContain('her etkilenen hücre için AYRI düzenleme')
  })

  it('trims the operator instruction', () => {
    expect(prompt.user.endsWith('İstek: cuma 003 aracını 9A yap')).toBe(true)
  })
})

describe('parseAssistantProposal', () => {
  it('reads a well-formed answer', () => {
    const proposal = parseAssistantProposal(
      '{"edits":[{"plate":"003","dayIndex":5,"code":"9A","reason":"hat değişti"}]}',
    )

    expect(proposal.problems).toEqual([])
    expect(proposal.edits).toEqual([{ plate: '003', dayIndex: 5, code: '9A', reason: 'hat değişti' }])
  })

  it('accepts a day name instead of a number and a bare array', () => {
    const proposal = parseAssistantProposal('[{"plate":"030","day":"cumartesi","code":"x"}]')
    expect(proposal.problems).toEqual([])
    expect(proposal.edits[0]?.dayIndex).toBe(6)
  })

  it('never throws on prose, bad days or missing fields', () => {
    expect(parseAssistantProposal('Elbette! İşte plan:').problems).toEqual(['yanıt JSON değil'])

    const broken = parseAssistantProposal(
      JSON.stringify({
        edits: [
          { plate: '003', dayIndex: 9, code: '9A' },
          { dayIndex: 1, code: '9A' },
          { plate: '003', dayIndex: 1 },
          'nonsense',
        ],
      }),
    )

    expect(broken.edits).toEqual([])
    expect(broken.problems).toHaveLength(4)
  })

  it('caps an oversized answer instead of applying it wholesale', () => {
    const tooMany = {
      edits: Array.from({ length: MAX_EDITS_PER_REQUEST + 5 }, () => ({ plate: '003', dayIndex: 1, code: '9A' })),
    }
    const proposal = parseAssistantProposal(JSON.stringify(tooMany))

    expect(proposal.edits).toHaveLength(MAX_EDITS_PER_REQUEST)
    expect(proposal.problems[0]).toContain('en fazla')
  })

  it('drops an empty reason instead of storing blank text', () => {
    const proposal = parseAssistantProposal('{"edits":[{"plate":"003","dayIndex":2,"code":"9A","reason":"  "}]}')
    expect(proposal.edits[0]).toEqual({ plate: '003', dayIndex: 2, code: '9A' })
  })
})
