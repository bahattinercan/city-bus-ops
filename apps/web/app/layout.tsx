import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'City Bus Ops',
  description: 'Şehir içi otobüs operasyon sistemi — planlama, görev, şoför',
}

const NAV = [
  { href: '/', label: 'Özet' },
  { href: '/network', label: 'Ağ & Tarife' },
  { href: '/plan', label: 'Haftalık Plan' },
  { href: '/drivers', label: 'Şoförler' },
  { href: '/reports', label: 'Raporlar' },
]

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            City&nbsp;Bus&nbsp;Ops
          </Link>
          <nav>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
