import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth'
import { logoutAction } from './actions/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'City Bus Ops',
  description: 'Şehir içi otobüs operasyon sistemi — planlama, görev, şoför',
}

const NAV: ReadonlyArray<{ href: string; label: string; roles: readonly string[] }> = [
  { href: '/', label: 'Özet', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/network', label: 'Ağ & Tarife', roles: ['admin', 'planner'] },
  { href: '/plan', label: 'Haftalık Plan', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/drivers', label: 'Şoförler', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/reports', label: 'Raporlar', roles: ['admin', 'planner', 'dispatcher'] },
  { href: '/driver', label: 'Benim Haftam', roles: ['driver'] },
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

  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <Link href={session === null ? '/login' : session.role === 'driver' ? '/driver' : '/'} className="brand">
            City&nbsp;Bus&nbsp;Ops
          </Link>
          <nav>
            {items.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="session">
            {session === null ? (
              <Link href="/login">Giriş</Link>
            ) : (
              <>
                <span className="muted" title={session.email}>
                  {ROLE_LABEL[session.role] ?? session.role}
                </span>
                <form action={logoutAction}>
                  <button type="submit" className="secondary">
                    Çıkış
                  </button>
                </form>
              </>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
