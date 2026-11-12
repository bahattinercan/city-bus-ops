import { auditLog, type Database } from '@citybus/db'

export type AuditEntry = {
  readonly organisationId: string
  readonly actorUserId: string | null
  readonly action: string
  readonly entity: string
  readonly entityId?: string | null
  readonly payload?: Record<string, unknown> | null
}

/**
 * Append-only audit trail. A failed write is reported but never breaks the user's action:
 * losing an audit row is bad, discarding a published plan because of it is worse.
 */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      organisationId: entry.organisationId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      payload: entry.payload ?? null,
    })
  } catch (error) {
    console.error(`audit write failed (${entry.action} ${entry.entity}):`, error)
  }
}
