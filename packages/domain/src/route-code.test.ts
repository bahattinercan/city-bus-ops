import { describe, expect, it } from 'vitest'
import { RouteCode } from './route-code'

describe('RouteCode', () => {
  it('normalises case and noise', () => {
    expect(RouteCode.parse('9at').value).toBe('9AT')
    expect(RouteCode.parse(' 12g ').value).toBe('12G')
    expect(RouteCode.parse('1.2').value).toBe('12')
  })

  it('accepts every code shape seen on the real sheets', () => {
    for (const code of ['2', '5', '20', '108', '203', '9A', '9AT', '1A', 'A1', '12G', '12P']) {
      if (code === 'A1') {
        // Letter-first codes exist in the legacy sheets but their meaning is unconfirmed
        // (legacy question S3), so the parser refuses them instead of guessing.
        expect(() => RouteCode.parse(code)).toThrow(/Invalid route code/)
        continue
      }
      expect(RouteCode.parse(code).value).toBe(code)
    }
  })

  it('splits numeric part and suffix', () => {
    expect(RouteCode.parse('9AT').number).toBe(9)
    expect(RouteCode.parse('9AT').suffix).toBe('AT')
    expect(RouteCode.parse('203').suffix).toBe('')
  })

  it.each(['', 'abc', '1234', '-20', '12 G 4'])('rejects %o', (input) => {
    expect(() => RouteCode.parse(input)).toThrow(/Invalid route code/)
  })
})
