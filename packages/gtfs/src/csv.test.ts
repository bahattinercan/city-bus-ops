import { describe, expect, it } from 'vitest'
import { formatCsv, parseCsv, parseCsvObjects } from './csv'

describe('parseCsv', () => {
  it('reads plain rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('handles quoted commas, quotes and newlines', () => {
    const input = 'name,note\n"Durak, merkez","iki ""tırnak"" var"\n"çok\nsatır",x\n'
    expect(parseCsv(input)).toEqual([
      ['name', 'note'],
      ['Durak, merkez', 'iki "tırnak" var'],
      ['çok\nsatır', 'x'],
    ])
  })

  it('ignores CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps empty trailing fields', () => {
    expect(parseCsv('a,b,c\n1,,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })
})

describe('formatCsv', () => {
  it('quotes only when needed', () => {
    expect(formatCsv([['a', 'b'], ['1', '2']])).toBe('a,b\n1,2\n')
    expect(formatCsv([['a', 'Durak, merkez']])).toBe('a,"Durak, merkez"\n')
    expect(formatCsv([['a', 'iki "tırnak"']])).toBe('a,"iki ""tırnak"""\n')
  })

  it('round-trips a tricky table', () => {
    const rows = [
      ['stop_id', 'stop_name'],
      ['S1', 'Cumhuriyet, 3. durak'],
      ['S2', 'Yeni "otogar"'],
    ]
    expect(parseCsv(formatCsv(rows))).toEqual(rows)
  })
})

describe('parseCsvObjects', () => {
  it('maps header names to values and trims them', () => {
    expect(parseCsvObjects('a, b \n 1 , 2 \n')).toEqual([{ a: '1', b: '2' }])
  })

  it('returns an empty array for an empty file', () => {
    expect(parseCsvObjects('')).toEqual([])
  })
})
