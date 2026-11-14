import { describe, expect, it } from 'vitest'
import { MAX_EDITS_PER_REQUEST, parseEditDay, parseEditText, resolveEdits } from './plan-edit'

const targets = {
  vehicles: [
    { id: 'v-003', plate: '003' },
    { id: 'v-030', plate: '030' },
    { id: 'v-042', plate: '042' },
  ],
  routeCodes: ['9A', '20'],
}

describe('parseEditDay', () => {
  it('reads full names, short spellings and numbers', () => {
    expect(parseEditDay('pazartesi')).toBe(1)
    expect(parseEditDay('CUMA')).toBe(5)
    expect(parseEditDay('cmt')).toBe(6)
    expect(parseEditDay('pazar')).toBe(7)
    expect(parseEditDay('3')).toBe(3)
  })

  it('accepts ASCII spellings of Turkish day names', () => {
    expect(parseEditDay('carsamba')).toBe(3)
    expect(parseEditDay('perşembe')).toBe(4)
  })

  it('returns undefined for anything it does not recognise', () => {
    expect(parseEditDay('yarın')).toBeUndefined()
    expect(parseEditDay('')).toBeUndefined()
    expect(parseEditDay('8')).toBeUndefined()
  })
})

describe('parseEditText', () => {
  it('reads one edit per line and keeps multi-token codes', () => {
    const { edits, errors } = parseEditText(`
      003 cuma 9A
      030 pzt -20
      # yorum satırı
      042 cmt  otogar gar
    `)

    expect(errors).toEqual([])
    expect(edits).toEqual([
      { plate: '003', dayIndex: 5, code: '9A' },
      { plate: '030', dayIndex: 1, code: '-20' },
      { plate: '042', dayIndex: 6, code: 'otogar gar' },
    ])
  })

  it('treats a line without a code as an empty cell', () => {
    const { edits, errors } = parseEditText('060 sal')
    expect(errors).toEqual([])
    expect(edits).toEqual([{ plate: '060', dayIndex: 2, code: '' }])
  })

  it('reports the day it cannot understand instead of guessing', () => {
    const { edits, errors } = parseEditText('003 yarın 9A\n003 cuma 9A')
    expect(edits).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.line).toBe('003 yarın 9A')
  })

  it('reports a line that stops after the plate', () => {
    const { errors } = parseEditText('003')
    expect(errors[0]?.reason).toContain('gün eksik')
  })
})

describe('resolveEdits', () => {
  it('resolves a duty, an idle marker and a start time', () => {
    const { resolved, rejected } = resolveEdits(
      [
        { plate: '003', dayIndex: 5, code: '9A' },
        { plate: '030', dayIndex: 1, code: 'YAT' },
        { plate: '042', dayIndex: 7, code: '12.00' },
      ],
      targets,
    )

    expect(rejected).toEqual([])
    expect(resolved.map((row) => [row.vehicleId, row.cell.kind])).toEqual([
      ['v-003', 'duty'],
      ['v-030', 'empty'],
      ['v-042', 'startTime'],
    ])
  })

  it('rejects an unknown plate, an unknown route and a guessed code', () => {
    const { resolved, rejected } = resolveEdits(
      [
        { plate: '999', dayIndex: 1, code: '9A' },
        { plate: '003', dayIndex: 1, code: '77B' },
        { plate: '030', dayIndex: 2, code: 'otogar' },
      ],
      targets,
    )

    expect(resolved).toEqual([])
    expect(rejected.map((row) => row.reason)).toEqual([
      'araç bulunamadı: 999',
      'hat kodu tanımlı değil: 77B',
      'hücre kodu anlaşılmadı: "otogar"',
    ])
  })

  it('rejects the same cell twice in one request', () => {
    const { rejected } = resolveEdits(
      [
        { plate: '003', dayIndex: 3, code: '9A' },
        { plate: '003', dayIndex: 3, code: 'YAT' },
      ],
      targets,
    )

    expect(rejected[0]?.reason).toContain('iki kez')
  })

  it('refuses to rewrite more cells than the blast-radius limit', () => {
    const edits = Array.from({ length: MAX_EDITS_PER_REQUEST + 1 }, () => ({
      plate: '003',
      dayIndex: 1 as const,
      code: '9A',
    }))

    const { resolved, rejected } = resolveEdits(edits, targets)
    expect(resolved).toEqual([])
    expect(rejected).toHaveLength(MAX_EDITS_PER_REQUEST + 1)
  })
})
