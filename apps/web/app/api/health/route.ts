import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Liveness + database readiness, for container health checks and uptime monitors. */
export async function GET() {
  const startedAt = Date.now()
  try {
    const rows = await getSql()<{ ok: number }[]>`select 1 as ok`
    const ready = rows[0]?.ok === 1
    return Response.json(
      {
        status: ready ? 'ok' : 'degraded',
        database: ready ? 'up' : 'down',
        latencyMs: Date.now() - startedAt,
        version: process.env.npm_package_version ?? '0.1.0',
      },
      { status: ready ? 200 : 503 },
    )
  } catch (error) {
    return Response.json(
      {
        status: 'down',
        database: 'unreachable',
        error: (error as Error).message,
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    )
  }
}
