'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearSessionCookie, ensureDemoUsers, isRole, login, setLocalRole } from '@/lib/auth'

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (email === '' || password === '') {
    redirect('/login?error=' + encodeURIComponent('E-posta ve şifre zorunlu.'))
  }

  await ensureDemoUsers()
  const result = await login(email, password)

  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.message)}`)
  }

  redirect(result.role === 'driver' ? '/driver' : '/')
}

/** Local mode: switches the working role without a password. */
export async function setRoleAction(formData: FormData): Promise<void> {
  const role = formData.get('role')
  if (!isRole(role)) {
    redirect('/')
  }
  await setLocalRole(role)
  revalidatePath('/', 'layout')
  redirect(role === 'driver' ? '/driver' : '/')
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie()
  redirect('/login')
}
