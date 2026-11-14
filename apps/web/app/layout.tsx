import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { getSession, localMode } from '@/lib/auth'
import { LOCALES, getMessages, roleLabel, type Locale, type Messages } from '@/lib/i18n'
import { logoutAction, setLocaleAction, setRoleAction } from './actions/auth'
import { RailNav } from './_components/rail-nav'
import './globals.css'

const body = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-body-face',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-face',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'City Bus Ops',
  description:
    'City bus operations system — planning, duties, drivers. Şehir içi otobüs operasyon sistemi.',
}

/** Labels come from the dictionary; the role list decides who sees the link. */
const NAV: ReadonlyArray<{ href: string; key: keyof Messages['nav']; roles: readonly string[] }> = [
  { href: '/', key: 'overview', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/network', key: 'network', roles: ['admin', 'planner'] },
  { href: '/plan', key: 'plan', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/drivers', key: 'drivers', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/reports', key: 'reports', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/driver', key: 'driver', roles: ['driver'] },
  { href: '/help', key: 'help', roles: ['admin', 'planner', 'dispatcher', 'driver'] },
]

const SWITCHABLE_ROLES = ['admin', 'planner', 'dispatcher', 'driver'] as const

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const { locale, m } = await getMessages()
  const items = NAV.filter((item) => session !== null && item.roles.includes(session.role)).map(
    (item) => ({ href: item.href, label: m.nav[item.key] }),
  )
  const home = session === null ? '/login' : session.role === 'driver' ? '/driver' : '/'
  const utc = new Date().toISOString().slice(11, 19)
  const local = localMode()

  return (
    <html lang={locale} data-style="planetary-service" className={`${body.variable} ${mono.variable}`}>
      <body>
        <div className={session === null ? 'shell anonymous' : 'shell'}>
          {session !== null && (
            <aside className="rail">
              <Link href={home} className="brand">
                City Bus Ops
              </Link>
              <RailNav items={items} label={m.nav.main} />
              <div className="rail-foot">
                {local ? (
                  <form action={setRoleAction} className="role-switch">
                    <label>
                      {m.roles.switchLabel}
                      <select name="role" defaultValue={session.role}>
                        {SWITCHABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(m, role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="secondary">
                      {m.roles.switchSubmit}
                    </button>
                  </form>
                ) : (
                  <div className="session">
                    <span title={session.email}>{roleLabel(m, session.role)}</span>
                    <form action={logoutAction}>
                      <button type="submit" className="secondary">
                        {m.login.submit}
                      </button>
                    </form>
                  </div>
                )}
                <form action={setLocaleAction} className="lang-switch">
                  <label>
                    {m.app.languages.label}
                    <select name="locale" defaultValue={locale}>
                      {LOCALES.map((code: Locale) => (
                        <option key={code} value={code}>
                          {m.app.languages[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="secondary">
                    {locale === 'tr' ? 'EN' : 'TR'}
                  </button>
                </form>
                <div className="rail-clock">{utc} UTC</div>
              </div>
            </aside>
          )}
          <div className="workspace">
            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
