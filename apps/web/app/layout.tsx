import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { getSession, localMode } from '@/lib/auth'
import { logoutAction, setRoleAction } from './actions/auth'
import { RailNav, type RailItem } from './_components/rail-nav'
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
  description: 'Şehir içi otobüs operasyon sistemi — planlama, görev, şoför',
}

const NAV: ReadonlyArray<RailItem & { roles: readonly string[] }> = [
  { href: '/', label: 'Özet', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/network', label: 'Ağ & Tarife', roles: ['admin', 'planner'] },
  { href: '/plan', label: 'Haftalık Plan', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/drivers', label: 'Şoförler', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/reports', label: 'Raporlar', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/driver', label: 'Benim Haftam', roles: ['driver'] },
  { href: '/help', label: 'Nasıl Kullanılır', roles: ['admin', 'planner', 'dispatcher', 'driver'] },
]

const ROLE_LABEL: Record<string, string> = {
  admin: 'yönetici',
  planner: 'planlama',
  dispatcher: 'santral',
  driver: 'şoför',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const items = NAV.filter((item) => session !== null && item.roles.includes(session.role))
  const home = session === null ? '/login' : session.role === 'driver' ? '/driver' : '/'
  const utc = new Date().toISOString().slice(11, 19)
  const local = localMode()

  return (
    <html lang="tr" data-style="planetary-service" className={`${body.variable} ${mono.variable}`}>
      <body>
        <div className={session === null ? 'shell anonymous' : 'shell'}>
          {session !== null && (
            <aside className="rail">
              <Link href={home} className="brand">
                City Bus Ops
              </Link>
              <RailNav items={items} />
              <div className="rail-foot">
                {local ? (
                  <form action={setRoleAction} className="role-switch">
                    <label>
                      Rol
                      <select name="role" defaultValue={session.role}>
                        {Object.entries(ROLE_LABEL).map(([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="secondary">
                      Geç
                    </button>
                  </form>
                ) : (
                  <div className="session">
                    <span title={session.email}>{ROLE_LABEL[session.role] ?? session.role}</span>
                    <form action={logoutAction}>
                      <button type="submit" className="secondary">
                        Çıkış
                      </button>
                    </form>
                  </div>
                )}
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
