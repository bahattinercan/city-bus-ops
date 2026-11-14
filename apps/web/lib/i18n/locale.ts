import { cookies } from 'next/headers'

/**
 * Interface language. The operator default is Turkish (`AGENTS.md`); English is one click
 * away in the sidebar and is remembered in a cookie, so a single workstation can hand the
 * app over between a Turkish-speaking planner and a colleague who prefers English.
 */
export type Locale = 'tr' | 'en'

export const LOCALES: readonly Locale[] = ['tr', 'en']
export const DEFAULT_LOCALE: Locale = 'tr'

const COOKIE = 'cb_lang'
const YEAR_SECONDS = 365 * 24 * 60 * 60

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const stored = store.get(COOKIE)?.value
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies()
  store.set(COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR_SECONDS,
  })
}
