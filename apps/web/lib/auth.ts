import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { drivers, users } from '@citybus/db'
import { getDb, getOrganisation } from './db'

export type Role = 'admin' | 'planner' | 'dispatcher' | 'driver'

export type Session = {
  readonly userId: string
  readonly role: Role
  readonly driverId: string | null
  readonly organisationId: string
  readonly email: string
}

const COOKIE_NAME = 'cb_session'
const ROLE_COOKIE = 'cb_role'
const SESSION_DAYS = 7
const ROLES: readonly Role[] = ['admin', 'planner', 'dispatcher', 'driver']

/**
 * The desktop app runs on one workstation, so a password proves nothing: the operator is
 * already at the machine. In local mode the session comes from the role the operator picked
 * in the sidebar (default: admin) and the accounts exist only to keep foreign keys and the
 * audit trail valid. The web/server variant keeps the password flow.
 */
export function localMode(): boolean {
  return process.env.CITYBUS_LOCAL_MODE === '1'
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}

let localAccountsReady = false

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (value !== undefined && value.length >= 16) return value
  // Development fallback: sessions are not portable across restarts, which is acceptable
  // locally and fails loudly in a deployment checklist (docs/06-deploy.md).
  return `dev-only-${process.env.CITYBUS_DB_FILE ?? 'no-db'}`
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || salt === undefined || hash === undefined) return false
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function encode(session: Session): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function decode(token: string | undefined): Session | null {
  if (token === undefined) return null
  const [payload, signature] = token.split('.')
  if (payload === undefined || signature === undefined) return null
  if (sign(payload) !== signature) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session & {
      exp: number
    }
    if (parsed.exp < Date.now()) return null
    return {
      userId: parsed.userId,
      role: parsed.role,
      driverId: parsed.driverId,
      organisationId: parsed.organisationId,
      email: parsed.email,
    }
  } catch {
    return null
  }
}

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const fromCookie = decode(store.get(COOKIE_NAME)?.value)
  if (fromCookie !== null) return fromCookie
  if (!localMode()) return null
  const chosen = store.get(ROLE_COOKIE)?.value
  return localSession(isRole(chosen) ? chosen : 'admin')
}

/**
 * Resolves the account row for a role. The rows are created once per process; their password
 * hash is never used in local mode.
 */
async function localSession(role: Role): Promise<Session> {
  if (!localAccountsReady) {
    await ensureDemoUsers()
    localAccountsReady = true
  }

  const db = getDb()
  const [user] = await db.select().from(users).where(eq(users.role, role)).limit(1)
  if (user === undefined) {
    throw new Error(`local mode: no account for role ${role}`)
  }

  return {
    userId: user.id,
    role,
    driverId: user.driverId,
    organisationId: user.organisationId,
    email: user.email,
  }
}

/** Remembers the role the operator picked; local mode only. */
export async function setLocalRole(role: Role): Promise<void> {
  const store = await cookies()
  store.set(ROLE_COOKIE, role, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 })
}

/** Page guard: redirects to the login screen unless the session holds one of the roles. */
export async function requireSession(roles?: readonly Role[]): Promise<Session> {
  const session = await getSession()
  if (session === null) {
    redirect('/login')
  }
  if (roles !== undefined && !roles.includes(session.role)) {
    redirect(session.role === 'driver' ? '/driver' : '/')
  }
  return session
}

export type LoginResult = { readonly ok: true; readonly role: Role } | { readonly ok: false; readonly message: string }

export async function login(email: string, password: string): Promise<LoginResult> {
  const db = getDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1)

  if (user === undefined || !user.active) {
    return { ok: false, message: 'E-posta veya şifre hatalı.' }
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, message: 'E-posta veya şifre hatalı.' }
  }

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    driverId: user.driverId,
    organisationId: user.organisationId,
    email: user.email,
  })

  return { ok: true, role: user.role }
}

/** Creates the demo accounts and drivers on first run. Passwords come from the environment. */
export async function ensureDemoUsers(): Promise<void> {
  const organisation = await getOrganisation()
  const db = getDb()
  const password = process.env.CITYBUS_DEMO_PASSWORD ?? 'demo1234'
  const [firstDriver] = await db.select().from(drivers).limit(1)

  await db
    .insert(users)
    .values([
      {
        organisationId: organisation.id,
        email: 'admin@kutahya.local',
        passwordHash: hashPassword(password),
        role: 'admin',
      },
      {
        organisationId: organisation.id,
        email: 'planlama@kutahya.local',
        passwordHash: hashPassword(password),
        role: 'planner',
      },
      {
        organisationId: organisation.id,
        email: 'santral@kutahya.local',
        passwordHash: hashPassword(password),
        role: 'dispatcher',
      },
    ])
    .onConflictDoNothing()

  // The driver account is kept in sync: it must point at a real driver record.
  await db
    .insert(users)
    .values({
      organisationId: organisation.id,
      email: 'sofor@kutahya.local',
      passwordHash: hashPassword(password),
      role: 'driver',
      driverId: firstDriver?.id ?? null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { driverId: firstDriver?.id ?? null },
    })
}
