import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * Operational master schema (layer 1 of 3).
 *
 * Layer 2 (GTFS / GTFS-RT / TODS) is generated from this and never hand-edited.
 * Layer 3 is the `x_` extension namespace for rules the standards do not model
 * (standby, 7-week rotation, extra-duty codes). See docs/02-data-model.md.
 */

export const organisations = pgTable('organisation', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull().default('TR'),
  timeZone: text('time_zone').notNull().default('Europe/Istanbul'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('organisation_slug_key').on(table.slug)])

export const depots = pgTable('depot', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
}, (table) => [uniqueIndex('depot_org_code_key').on(table.organisationId, table.code)])

export const vehicles = pgTable('vehicle', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id')
    .notNull()
    .references(() => organisations.id, { onDelete: 'cascade' }),
  depotId: uuid('depot_id').references(() => depots.id, { onDelete: 'set null' }),
  /** 3-digit fleet number as printed on the plan: '003', '134'. */
  plateNumber: text('plate_number').notNull(),
  capacity: integer('capacity'),
  /** 'active' | 'maintenance' | 'retired' — kept as text until M1 models it as a table. */
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('vehicle_org_plate_key').on(table.organisationId, table.plateNumber)])
