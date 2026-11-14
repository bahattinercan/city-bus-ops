import { describe, expect, it } from 'vitest'
import { en } from './dictionaries/en'
import { tr } from './dictionaries/tr'
import { dayLabel, dayLabelByIndex, errorText, format, roleLabel, ruleTitle, violationText } from './index'

type Node = Record<string, unknown>

function walk(value: unknown, path: string, sink: Map<string, unknown>): Map<string, unknown> {
  if (Array.isArray(value)) {
    sink.set(`${path}[]`, value.length)
    return sink
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value as Node)) {
      walk(child, path === '' ? key : `${path}.${key}`, sink)
    }
    return sink
  }
  sink.set(path, value)
  return sink
}

describe('dictionaries', () => {
  // The type annotation on `en` catches missing keys at compile time; this catches the
  // cases types cannot: an empty translation, or a placeholder that only exists in one file.
  it('has the same keys in both languages', () => {
    const trKeys = [...walk(tr, '', new Map()).keys()].sort()
    const enKeys = [...walk(en, '', new Map()).keys()].sort()
    expect(enKeys).toEqual(trKeys)
  })

  it('has no empty or placeholder-only copy', () => {
    const entries = [...walk(tr, '', new Map()), ...walk(en, '', new Map())]
    const empty = entries.filter(([, value]) => typeof value === 'string' && value.trim() === '')
    expect(empty).toEqual([])
  })

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string): string[] =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()

    const trFlat = walk(tr, '', new Map())
    const enFlat = walk(en, '', new Map())
    const mismatched: string[] = []
    for (const [key, value] of trFlat) {
      const other = enFlat.get(key)
      if (typeof value !== 'string' || typeof other !== 'string') continue
      if (placeholders(value).join(',') !== placeholders(other).join(',')) mismatched.push(key)
    }
    expect(mismatched).toEqual([])
  })

  it('translates every rule code the domain can emit', () => {
    for (const code of ['R1', 'R9', 'R18']) {
      expect(ruleTitle(tr, code)).toBeDefined()
      expect(ruleTitle(en, code)).toBeDefined()
    }
    for (const code of ['L1', 'L5']) {
      expect(ruleTitle(tr, code)).toBeDefined()
      expect(ruleTitle(en, code)).toBeDefined()
    }
    expect(ruleTitle(tr, 'NOPE')).toBeUndefined()
  })
})

describe('format', () => {
  it('replaces placeholders and leaves unknown ones alone', () => {
    expect(format('{a} + {b}', { a: 1, b: 'x' })).toBe('1 + x')
    expect(format('{missing}', {})).toBe('{missing}')
  })

  it('keeps a value that contains braces intact', () => {
    expect(format('code {code}', { code: '{x}' })).toBe('code {x}')
  })
})

describe('violations', () => {
  const violation = {
    code: 'R1',
    message: 'Araç 42 2026-11-16 gününde birden fazla göreve atanmış.',
    key: 'R1.duplicateDuty',
    params: { plate: '42', date: '2026-11-16' },
  }

  it('renders the sentence in the interface language', () => {
    expect(violationText(tr, violation)).toBe(
      'Araç 42 2026-11-16 gününde birden fazla göreve atanmış.',
    )
    expect(violationText(en, violation)).toBe(
      'Vehicle 42 is assigned to more than one duty on 2026-11-16.',
    )
  })

  it('falls back to the domain sentence when the key is unknown', () => {
    const unknown = { code: 'R99', message: 'Yeni kural', key: 'R99.new' }
    expect(violationText(en, unknown)).toBe('Yeni kural')
    expect(violationText(en, { code: 'R99', message: 'Yeni kural' })).toBe('Yeni kural')
  })

  it('translates the labour rules as well', () => {
    const rest = {
      code: 'L4',
      message: 'İki görev arasında 09:00 dinlenme var, en az 11:00 olmalı.',
      key: 'L4.restTooShort',
      params: { rest: '09:00', limit: '11:00' },
    }
    expect(violationText(en, rest)).toBe(
      'Rest between two duties is 09:00, at least 11:00 is required.',
    )
  })
})

describe('labels', () => {
  it('maps day types and indexes', () => {
    expect(dayLabel(tr, 'wednesday')).toBe('Çarşamba')
    expect(dayLabel(en, 'wednesday')).toBe('Wednesday')
    expect(dayLabelByIndex(en, 3)).toBe('Wednesday')
    expect(dayLabel(tr, 'unknown')).toBe('unknown')
  })

  it('maps roles', () => {
    expect(roleLabel(tr, 'dispatcher')).toBe('santral')
    expect(roleLabel(en, 'dispatcher')).toBe('dispatcher')
    expect(roleLabel(en, 'nobody')).toBe('nobody')
  })
})

describe('errorText', () => {
  it('translates a known key', () => {
    expect(errorText(tr, 'planMissing')).toBe('Bu hafta için plan yok.')
    expect(errorText(en, 'planMissing')).toBe('There is no plan for this week.')
  })

  it('fills parameters', () => {
    expect(errorText(en, 'unknownPlate', { plate: '42' })).toBe('Unknown plate: 42')
  })

  it('shows an unknown value verbatim instead of hiding it', () => {
    expect(errorText(en, 'serbest metin')).toBe('serbest metin')
    expect(errorText(en, '')).toBeUndefined()
    expect(errorText(en, undefined)).toBeUndefined()
  })
})
