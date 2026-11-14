import { getLocale, type Locale } from './locale'
import { MESSAGES } from './text'
import type { Messages } from './dictionaries/tr'

export * from './text'
export {
  DEFAULT_LOCALE,
  LOCALES,
  getLocale,
  isLocale,
  setLocaleCookie,
} from './locale'
export type { Locale } from './locale'

export type MessagesFor = {
  readonly locale: Locale
  readonly m: Messages
}

/** Resolves the interface language once per request and hands back its dictionary. */
export async function getMessages(): Promise<MessagesFor> {
  const locale = await getLocale()
  return { locale, m: MESSAGES[locale] }
}
