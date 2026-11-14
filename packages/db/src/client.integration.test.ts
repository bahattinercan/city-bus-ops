import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb, migrateDb } from './client'

/**
 * Integration check against a real SQLite file. This is the desktop dialect, so it always
 * runs — no server, no skip: a temp directory, the migration chain, then the assertions.
 */
const directory = mkdtempSync(join(tmpdir(), 'citybus-db-'))
const handle = createDb(join(directory, 'probe.db'))
migrateDb(handle.db, join(import.meta.dirname, '..', 'drizzle-sqlite'))

afterAll(() => {
  handle.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('sqlite connection', () => {
  it('answers a query', () => {
    const [row] = handle.db.all<{ ok: number }>(sql`select 1 as ok`)
    expect(row?.ok).toBe(1)
  })

  it('has the operational tables from the migration', () => {
    const rows = handle.db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    )
    const names = rows.map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['depot', 'organisation', 'vehicle', 'plan_version', 'assignment']))
  })

  it('keeps WAL journaling and foreign keys on', () => {
    const [journal] = handle.db.all<{ journal_mode: string }>(sql`pragma journal_mode`)
    const [foreignKeys] = handle.db.all<{ foreign_keys: number }>(sql`pragma foreign_keys`)
    expect(journal?.journal_mode).toBe('wal')
    expect(foreignKeys?.foreign_keys).toBe(1)
  })

  it('cascades a delete through the plan graph', () => {
    const [organisation] = handle.db.all<{ id: string }>(
      sql`insert into organisation (id, slug, name) values ('org-test', 'probe', 'Probe') returning id`,
    )
    expect(organisation?.id).toBe('org-test')

    handle.db.run(sql`insert into plan_version (id, organisation_id, week_start, week_offset) values ('pv-test', 'org-test', '2026-11-09', 0)`)
    handle.db.run(sql`insert into rule_violation (id, plan_version_id, code, severity, message) values ('rv-test', 'pv-test', 'R1', 'hard', 'probe')`)
    const [stamped] = handle.db.all<{ created_at: number }>(sql`select created_at from plan_version where id = 'pv-test'`)
    // the SQL default must have filled it in without help from the client
    expect(stamped?.created_at).toBeGreaterThan(1_700_000_000_000)
    handle.db.run(sql`delete from organisation where id = 'org-test'`)

    const remaining = handle.db.all<{ n: number }>(sql`select count(*) as n from rule_violation`)
    expect(remaining[0]?.n).toBe(0)
  })
})
