import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { errorText, getMessages } from '@/lib/i18n'
import { loginAction } from '../actions/auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { m } = await getMessages()
  const errorMessage = errorText(m, error)
  const session = await getSession()
  if (session !== null) {
    redirect(session.role === 'driver' ? '/driver' : '/')
  }

  return (
    <div className="auth">
      <h1>{m.login.title}</h1>
      <p className="lead">{m.login.lead}</p>

      {errorMessage !== undefined && <div className="notice error">{errorMessage}</div>}

      <form className="inline" action={loginAction}>
        <label>
          {m.login.email}
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          {m.login.password}
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">{m.login.submit}</button>
      </form>

      <p className="hint">{m.login.demoHint}</p>
      <p className="hint">
        <Link href="/api/gtfs">{m.home.gtfsArchive}</Link> — {m.login.gtfsNote}
      </p>
    </div>
  )
}
