'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type RailItem = { href: string; label: string }

/** Exact match for "/", prefix match for the section roots. */
function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function RailNav({ items, label }: { items: readonly RailItem[]; label: string }) {
  const pathname = usePathname()

  return (
    <nav className="rail-nav" aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
