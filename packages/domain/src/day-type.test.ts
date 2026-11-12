import { describe, expect, it } from 'vitest'
import { DAY_TYPES, PRINT_ORDER, dayIndex, parseDayLabel, printLabel } from './day-type'

describe('day types', () => {
  it('numbers days Monday-first for the rotation law', () => {
    expect(dayIndex('monday')).toBe(1)
    expect(dayIndex('sunday')).toBe(7)
    expect(DAY_TYPES).toHaveLength(7)
  })

  it('prints the Turkish heading used on the sheet', () => {
    expect(printLabel('sunday')).toBe('PAZAR')
    expect(printLabel('wednesday')).toBe('ÇARŞAMBA')
  })

  it('prints Sunday first', () => {
    expect(PRINT_ORDER[0]).toBe('sunday')
    expect(PRINT_ORDER[6]).toBe('monday')
  })

  it('parses Turkish and ASCII spellings in any case', () => {
    expect(parseDayLabel('pazartesi')).toBe('monday')
    expect(parseDayLabel('PAZARTESI')).toBe('monday')
    expect(parseDayLabel('Cumartesi')).toBe('saturday')
    expect(parseDayLabel('çarşamba')).toBe('wednesday')
    expect(parseDayLabel('noday')).toBeUndefined()
  })
})
