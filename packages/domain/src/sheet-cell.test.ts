import { describe, expect, it } from 'vitest'
import { assignsWork, parseSheetCell } from './sheet-cell'

describe('parseSheetCell', () => {
  it('reads a route duty', () => {
    const cell = parseSheetCell('9AT')
    expect(cell.kind).toBe('duty')
    expect(assignsWork(cell)).toBe(true)
  })

  it('reads a negative code as an extra duty on the base route', () => {
    const cell = parseSheetCell('-20')
    expect(cell).toEqual({ kind: 'extraDuty', route: expect.objectContaining({ value: '20' }), raw: '-20' })
  })

  it('reads the standby marker', () => {
    expect(parseSheetCell('x').kind).toBe('standby')
    expect(parseSheetCell('×').kind).toBe('standby')
  })

  it('reads first departure times, dot and colon form', () => {
    expect(parseSheetCell('12.00')).toEqual({ kind: 'startTime', minutes: 720, raw: '12.00' })
    expect(parseSheetCell('20:30')).toEqual({ kind: 'startTime', minutes: 1230, raw: '20:30' })
  })

  it('does not read a bare number as a time', () => {
    expect(parseSheetCell('12').kind).toBe('duty')
  })

  it('keeps unknown handwriting raw instead of guessing', () => {
    const cell = parseSheetCell('otogar')
    expect(cell.kind).toBe('text')
    expect(cell.raw).toBe('otogar')
    expect(assignsWork(cell)).toBe(false)
  })

  it('treats blank cells as empty', () => {
    expect(parseSheetCell('   ').kind).toBe('empty')
  })
})
