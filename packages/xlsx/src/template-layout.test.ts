import { describe, expect, it } from 'vitest'
import { MATRIX_SHEET, ROTATION_SHEET, TEMPLATE_VERSION, dayColumn } from './template-layout'

describe('template layout v2.0', () => {
  it('pins the version the operator validated', () => {
    expect(TEMPLATE_VERSION).toBe('2.0')
  })

  it('keeps the verified cell map', () => {
    expect(MATRIX_SHEET.headerRow).toBe(3)
    expect(MATRIX_SHEET.firstDataRow).toBe(4)
    expect(MATRIX_SHEET.lastDataRow).toBe(48)
    expect(MATRIX_SHEET.totalsRow).toBe(49)
    expect(MATRIX_SHEET.sequenceColumn).toBe('A')
    expect(MATRIX_SHEET.plateColumn).toBe('B')
    expect(MATRIX_SHEET.standbyColumn).toBe('J')
    expect(ROTATION_SHEET.name).toBe('ROTASYON')
  })

  it('maps seven day columns, Monday to Sunday, contiguous', () => {
    const columns = MATRIX_SHEET.dayColumns.map(([, column]) => column)
    expect(columns).toEqual(['C', 'D', 'E', 'F', 'G', 'H', 'I'])
    expect(columns).toHaveLength(7)
    expect(columns.at(-1)).toBe('I')
    expect(MATRIX_SHEET.standbyColumn).toBe('J')
  })

  it('resolves a day to its column', () => {
    expect(dayColumn('monday')).toBe('C')
    expect(dayColumn('sunday')).toBe('I')
  })
})
