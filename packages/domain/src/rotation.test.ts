import { describe, expect, it } from 'vitest'
import {
  ROTATION_CYCLE_WEEKS,
  cyclePosition,
  isoDate,
  parseIsoDate,
  rotationDayIndex,
  weekOffset,
  weekStartOf,
  type DayIndex,
} from './rotation'

describe('cyclePosition (F1-F2)', () => {
  it('maps week offsets to the 1..7 cycle position', () => {
    expect(cyclePosition(0)).toBe(1)
    expect(cyclePosition(6)).toBe(7)
    expect(cyclePosition(7)).toBe(1)
    expect(cyclePosition(-1)).toBe(7)
    expect(cyclePosition(-7)).toBe(1)
  })
})

describe('rotationDayIndex (F3)', () => {
  // Table from docs/legacy-data-model-and-scheduler.md §6.4, verified against the real sheets.
  const table: ReadonlyArray<{ g0: DayIndex; expected: Record<number, DayIndex> }> = [
    { g0: 5, expected: { [-1]: 6, 0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 7, 6: 6 } },
    { g0: 6, expected: { [-1]: 7, 0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 7 } },
    { g0: 1, expected: { [-1]: 2, 0: 1, 1: 7, 2: 6, 3: 5, 4: 4, 5: 3, 6: 2 } },
    { g0: 3, expected: { [-1]: 4, 0: 3, 1: 2, 2: 1, 3: 7, 4: 6, 5: 5, 6: 4 } },
  ]

  it.each(table)('matches the real sheets for g0=$g0', ({ g0, expected }) => {
    for (const [offset, day] of Object.entries(expected)) {
      expect(rotationDayIndex(g0, Number(offset))).toBe(day)
    }
  })

  it('repeats every seven weeks (F4)', () => {
    for (const g0 of [1, 2, 3, 4, 5, 6, 7] as DayIndex[]) {
      for (let w = -10; w <= 10; w += 1) {
        expect(rotationDayIndex(g0, w)).toBe(rotationDayIndex(g0, w + ROTATION_CYCLE_WEEKS))
      }
    }
  })
})

describe('week arithmetic (F1)', () => {
  it('finds the Monday of a week', () => {
    expect(isoDate(weekStartOf(new Date('2026-09-21T00:00:00Z')))).toBe('2026-09-21')
    expect(isoDate(weekStartOf(new Date('2026-09-27T00:00:00Z')))).toBe('2026-09-21')
    expect(isoDate(weekStartOf(new Date('2026-09-24T13:45:00Z')))).toBe('2026-09-21')
  })

  it('counts whole weeks from the anchor week', () => {
    const anchor = weekStartOf(new Date('2026-09-21T00:00:00Z'))
    expect(weekOffset(anchor, weekStartOf(new Date('2026-09-21T00:00:00Z')))).toBe(0)
    expect(weekOffset(anchor, weekStartOf(new Date('2026-10-05T00:00:00Z')))).toBe(2)
    expect(weekOffset(anchor, weekStartOf(new Date('2026-09-14T00:00:00Z')))).toBe(-1)
  })

  it('refuses dates that are not Mondays', () => {
    const anchor = weekStartOf(new Date('2026-09-21T00:00:00Z'))
    expect(() => weekOffset(anchor, new Date('2026-09-23T00:00:00Z'))).toThrow(/Monday/)
  })
})

describe('parseIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseIsoDate('2026-11-09')?.toISOString()).toBe('2026-11-09T00:00:00.000Z')
  })

  it('rejects anything a query string can contain', () => {
    expect(parseIsoDate('abc')).toBeUndefined()
    expect(parseIsoDate('')).toBeUndefined()
    expect(parseIsoDate('2026-11-9')).toBeUndefined()
    expect(parseIsoDate('09.11.2026')).toBeUndefined()
    expect(parseIsoDate('2026-02-31')).toBeUndefined()
    expect(parseIsoDate('2026-13-01')).toBeUndefined()
  })
})
