import { describe, expect, it } from 'vitest'
import { LABOUR_LIMITS, dutyMinutes, evaluateDutySpan, evaluateRest, formatMinutes, restMinutes } from './labour'

const fullDay = {
  startMinute: 6 * 60,
  endMinute: 14 * 60,
  drivingMinutes: 6 * 60,
  breakMinutes: 60,
}

describe('evaluateDutySpan', () => {
  it('accepts a normal duty', () => {
    expect(evaluateDutySpan(fullDay)).toEqual([])
  })

  it('flags too much driving (L1)', () => {
    const issues = evaluateDutySpan({ ...fullDay, drivingMinutes: LABOUR_LIMITS.maxDrivingMinutes + 1 })
    expect(issues.map((issue) => issue.code)).toContain('L1')
  })

  it('flags a duty span above the maximum (L2)', () => {
    const issues = evaluateDutySpan({ ...fullDay, endMinute: fullDay.startMinute + LABOUR_LIMITS.maxDutyMinutes + 30 })
    expect(issues.map((issue) => issue.code)).toContain('L2')
  })

  it('flags missing breaks for long driving (L3)', () => {
    const issues = evaluateDutySpan({ ...fullDay, drivingMinutes: 9 * 60, breakMinutes: 0 })
    expect(issues.map((issue) => issue.code)).toContain('L3')
  })

  it('measures an overnight duty without wrapping', () => {
    expect(dutyMinutes({ startMinute: 23 * 60 + 35, endMinute: 25 * 60 + 5 })).toBe(90)
  })
})

describe('rest between duties (L4)', () => {
  it('counts rest across midnight', () => {
    expect(restMinutes({ date: '2026-09-21', endMinute: 23 * 60 }, { date: '2026-09-22', startMinute: 6 * 60 })).toBe(7 * 60)
  })

  it('flags a short turn-around', () => {
    const issues = evaluateRest(
      { date: '2026-09-21', endMinute: 23 * 60 + 30 },
      { date: '2026-09-22', startMinute: 5 * 60 },
    )
    expect(issues.map((issue) => issue.code)).toEqual(['L4'])
  })

  it('accepts a full night of rest', () => {
    expect(
      evaluateRest({ date: '2026-09-21', endMinute: 20 * 60 }, { date: '2026-09-22', startMinute: 8 * 60 }),
    ).toEqual([])
  })
})

describe('formatMinutes', () => {
  it('prints hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1s 30dk')
    expect(formatMinutes(-30)).toBe('-0s 30dk')
  })
})
