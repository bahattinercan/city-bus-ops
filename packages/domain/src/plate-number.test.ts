import { describe, expect, it } from 'vitest'
import { PlateNumber } from './plate-number'

describe('PlateNumber', () => {
  it('keeps leading zeros and pads to three digits', () => {
    expect(PlateNumber.parse('003').value).toBe('003')
    expect(PlateNumber.parse('3').value).toBe('003')
    expect(PlateNumber.parse(' 30 ').value).toBe('030')
  })

  it('exposes the numeric form for sorting', () => {
    expect(PlateNumber.parse('134').number).toBe(134)
    expect(PlateNumber.parse('003').number).toBe(3)
  })

  it('compares by normalised value', () => {
    expect(PlateNumber.parse('3').equals(PlateNumber.parse('003'))).toBe(true)
    expect(PlateNumber.parse('134').equals(PlateNumber.parse('143'))).toBe(false)
  })

  it.each(['', ' ', 'abc', '1234', '12a', '-20'])('rejects %o', (input) => {
    expect(() => PlateNumber.parse(input)).toThrow(/Invalid fleet plate number/)
  })
})
