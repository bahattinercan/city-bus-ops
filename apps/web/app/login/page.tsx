import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { loginAction } from '../actions/auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const session = await getSession()
  if (session !== null) {
    redirect(session.role === 'driver' ? '/driver' : '/')
  }

  return (
    <>
      <h1>Giriş</h1>
      <p className="lead">Şehir içi otobüs operasyon sistemi.</p>

      {error !== undefined && <div className="notice error">{error}</div>}

      <form className="inline" action={loginAction}>
        <label>
          E-posta
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Şifre
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Giriş yap</button>
      </form>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Demo hesaplar ilk girişte oluşturulur: <code>admin@kutahya.local</code>,{' '}
        <code>planlama@kutahya.local</code>, <code>santral@kutahya.local</code> — şifre{' '}
        <code>CITYBUS_DEMO_PASSWORD</code> (varsayılan <code>demo1234</code>). Üretimde değiştirin.
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        <Link href="/api/gtfs">GTFS arşivi</Link> giriş gerektirmez.
      </p>
    </>
  )
}
