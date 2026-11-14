import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { DayType } from '@citybus/domain'

/**
 * Operational master schema (layer 1 of 3) — **SQLite**, the single dialect of the desktop
 * application. The table and column names are unchanged from the Postgres era, so the queries
 * and the docs still read the same; only the storage types moved.
 *
 * Dialect mapping (see docs/09-desktop-app.md):
 * - ids            `uuid` → `text` (generated here, `crypto.randomUUID()`)
 * - timestamps     `timestamptz` → `integer` (unix ms; Drizzle hands back `Date`)
 * - dates          `date` → `text` `YYYY-MM-DD` (the code always treated them as strings)
 * - booleans       `boolean` → `integer` 0/1 (`{ mode: 'boolean' }` gives `boolean`)
 * - jsonb          → `text` (`{ mode: 'json' }`)
 *
 * Layer 2 (GTFS / GTFS-RT / TODS) is generated from this and never hand-edited. Layer 3 is the
 * extension namespace for rules the standards do not model (`standby`, `extra_duty`, `cell_note`);
 * those are exported under an `x_` prefix. See docs/02-data-model.md.
 */

const id = () => text('id').primaryKey().$defaultFn(() => randomUUID())
/**
 * Timestamps are unix milliseconds. The default lives in SQL as well as in Drizzle, so a row
 * inserted by a migration script or by hand still gets a sane value.
 */
const nowMs = sql`(unixepoch() * 1000)`
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs)
const flag = (name: string, defaultValue = false) => integer(name, { mode: 'boolean' }).notNull().default(defaultValue)
const orgId = () => text('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' })

export const organisations = sqliteTable('organisation', {
  id: id(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull().default('TR'),
  timeZone: text('time_zone').notNull().default('Europe/Istanbul'),
  /** Monday of the week the 7-week rotation counts from (legacy `Rotation:AnchorWeek`). */
  rotationAnchorWeek: text('rotation_anchor_week').notNull().default('2026-09-21'),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('organisation_slug_key').on(table.slug)])

export const depots = sqliteTable('depot', {
  id: id(),
  organisationId: orgId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
}, (table) => [uniqueIndex('depot_org_code_key').on(table.organisationId, table.code)])

export const vehicles = sqliteTable('vehicle', {
  id: id(),
  organisationId: orgId(),
  depotId: text('depot_id').references(() => depots.id, { onDelete: 'set null' }),
  /** 3-digit fleet number as printed on the plan: '003', '134'. */
  plateNumber: text('plate_number').notNull(),
  capacity: integer('capacity'),
  lowFloor: flag('low_floor'),
  airConditioned: flag('air_conditioned'),
  /** 'printed' | 'handwritten' — legacy decision O5 kept `221`/`085` and `229`/`225` both in the fleet. */
  source: text('source').$type<'printed' | 'handwritten'>().notNull().default('printed'),
  status: text('status').$type<'active' | 'maintenance' | 'retired'>().notNull().default('active'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('vehicle_org_plate_key').on(table.organisationId, table.plateNumber),
  index('vehicle_org_status_idx').on(table.organisationId, table.status),
])

export const drivers = sqliteTable('driver', {
  id: id(),
  organisationId: orgId(),
  employeeNo: text('employee_no').notNull(),
  fullName: text('full_name').notNull(),
  licenceClass: text('licence_class').notNull().default('D'),
  /** Higher = more senior; used when a duty has to be picked manually. */
  seniority: integer('seniority').notNull().default(0),
  /** Rule the driver is bound to; drives roster generation. */
  homeDepotId: text('home_depot_id').references(() => depots.id, { onDelete: 'set null' }),
  active: flag('active', true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('driver_org_employee_key').on(table.organisationId, table.employeeNo)])

export const users = sqliteTable('app_user', {
  id: id(),
  organisationId: orgId(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'admin' | 'planner' | 'dispatcher' | 'driver'>().notNull(),
  driverId: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  active: flag('active', true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('app_user_email_key').on(table.email)])

export const routes = sqliteTable('route', {
  id: id(),
  organisationId: orgId(),
  /** Operator code: '5', '9AT', '26A'. Letter suffixes keep the operator's meaning. */
  code: text('code').notNull(),
  name: text('name').notNull(),
  requiredLowFloor: flag('required_low_floor'),
  requiredAc: flag('required_ac'),
  active: flag('active', true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('route_org_code_key').on(table.organisationId, table.code)])

export const stops = sqliteTable('stop', {
  id: id(),
  organisationId: orgId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  /** WGS84, kept as text: the map editor is a later milestone. */
  latitude: text('latitude'),
  longitude: text('longitude'),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('stop_org_code_key').on(table.organisationId, table.code)])

export const routeStops = sqliteTable('route_stop', {
  id: id(),
  routeId: text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  stopId: text('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  direction: integer('direction').notNull().default(0),
  sequence: integer('sequence').notNull(),
}, (table) => [uniqueIndex('route_stop_key').on(table.routeId, table.direction, table.sequence)])

export const trips = sqliteTable('trip', {
  id: id(),
  routeId: text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  dayType: text('day_type').$type<DayType>().notNull(),
  /** Minutes after midnight; may exceed 1440 for a trip after midnight. */
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  crossesMidnight: flag('crosses_midnight'),
  createdAt: createdAt(),
}, (table) => [
  index('trip_route_daytype_start_idx').on(table.routeId, table.dayType, table.startMinute),
  uniqueIndex('trip_route_daytype_start_key').on(table.routeId, table.dayType, table.startMinute),
])

export const tripStopTimes = sqliteTable('trip_stop_time', {
  id: id(),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  stopId: text('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  /** Minutes after midnight; may exceed 1440 after midnight. */
  arrivalMinute: integer('arrival_minute').notNull(),
  departureMinute: integer('departure_minute').notNull(),
}, (table) => [uniqueIndex('trip_stop_time_key').on(table.tripId, table.sequence)])

/** A duty group's weekday moves through the week (rotation law F1-F5). */
export const dutyGroups = sqliteTable('duty_group', {
  id: id(),
  organisationId: orgId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  vehicleCount: integer('vehicle_count').notNull(),
  /** Weekday of the group in the rotation anchor week (legacy `g0`), Monday = 1. */
  referenceDayIndex: integer('reference_day_index').notNull(),
  /** Route the group's duties run on; null until the operator assigns one. */
  defaultRouteId: text('default_route_id').references(() => routes.id, { onDelete: 'set null' }),
}, (table) => [uniqueIndex('duty_group_org_code_key').on(table.organisationId, table.code)])

export const planVersions = sqliteTable('plan_version', {
  id: id(),
  organisationId: orgId(),
  /** Monday of the planned week. */
  weekStart: text('week_start').notNull(),
  /** Whole weeks since the rotation anchor week (legacy `w`). */
  weekOffset: integer('week_offset').notNull(),
  status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('draft'),
  /** Printed weekly total on the sheet, when it is known (legacy `=76`). */
  reportedWeeklyVehicleDays: integer('reported_weekly_vehicle_days'),
  note: text('note'),
  publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('plan_version_org_week_key').on(table.organisationId, table.weekStart),
  index('plan_version_org_status_idx').on(table.organisationId, table.status),
])

export const assignments = sqliteTable('assignment', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  status: text('status').$type<'duty' | 'standby' | 'idle' | 'unavailable'>().notNull(),
  dutyGroupId: text('duty_group_id').references(() => dutyGroups.id, { onDelete: 'set null' }),
  routeId: text('route_id').references(() => routes.id, { onDelete: 'set null' }),
  /** Extra duty code (`-20`): an additional duty on another route (legacy S14). */
  extraDutyRouteId: text('extra_duty_route_id').references(() => routes.id, { onDelete: 'set null' }),
  /** First departure that day, minutes after midnight (legacy S15). */
  firstTripMinute: integer('first_trip_minute'),
  /** The cell text exactly as the operator wrote it. */
  rawCode: text('raw_code'),
  locked: flag('locked'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('assignment_plan_day_vehicle_key').on(table.planVersionId, table.dayIndex, table.vehicleId),
  index('assignment_plan_group_idx').on(table.planVersionId, table.dutyGroupId),
])

export const standbys = sqliteTable('standby', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  /** Null means the printed code is not in the route dictionary — publishing is blocked (R9). */
  routeId: text('route_id').references(() => routes.id, { onDelete: 'set null' }),
  rawCode: text('raw_code').notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('standby_plan_vehicle_key').on(table.planVersionId, table.vehicleId)])

/** Free-text handwriting on the sheet (`otogar`, `Demirci`) — kept, never interpreted. */
export const cellNotes = sqliteTable('cell_note', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index'),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  createdAt: createdAt(),
})

/** Which trips a vehicle actually runs that day — the output of vehicle blocking. */
export const blockTrips = sqliteTable('block_trip', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  tripId: text('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
}, (table) => [
  uniqueIndex('block_trip_plan_trip_key').on(table.planVersionId, table.tripId),
  index('block_trip_plan_vehicle_idx').on(table.planVersionId, table.dayIndex, table.vehicleId),
])

export const absences = sqliteTable('absence', {
  id: id(),
  organisationId: orgId(),
  driverId: text('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  dateFrom: text('date_from').notNull(),
  dateTo: text('date_to').notNull(),
  type: text('type').$type<'leave' | 'sick' | 'maintenance' | 'other'>().notNull(),
  note: text('note'),
  createdAt: createdAt(),
}, (table) => [index('absence_org_range_idx').on(table.organisationId, table.dateFrom, table.dateTo)])

export const rosterEntries = sqliteTable('roster_entry', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  driverId: text('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  drivingMinutes: integer('driving_minutes').notNull().default(0),
  breakMinutes: integer('break_minutes').notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('roster_entry_plan_day_driver_key').on(table.planVersionId, table.dayIndex, table.driverId),
  index('roster_entry_plan_vehicle_idx').on(table.planVersionId, table.dayIndex, table.vehicleId),
])

export const ruleViolations = sqliteTable('rule_violation', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  severity: text('severity').$type<'hard' | 'soft'>().notNull(),
  message: text('message').notNull(),
  dayIndex: integer('day_index'),
  vehicleId: text('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  driverId: text('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  dutyGroupId: text('duty_group_id').references(() => dutyGroups.id, { onDelete: 'cascade' }),
  detectedAt: integer('detected_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
}, (table) => [index('rule_violation_plan_code_idx').on(table.planVersionId, table.code)])

export const swapRequests = sqliteTable('swap_request', {
  id: id(),
  planVersionId: text('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  fromDriverId: text('from_driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  toDriverId: text('to_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  note: text('note'),
  decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: integer('decided_at', { mode: 'timestamp_ms' }),
  createdAt: createdAt(),
}, (table) => [index('swap_request_plan_status_idx').on(table.planVersionId, table.status)])

export const defectReports = sqliteTable('defect_report', {
  id: id(),
  organisationId: orgId(),
  vehicleId: text('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  driverId: text('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  severity: text('severity').$type<'low' | 'medium' | 'high'>().notNull().default('medium'),
  description: text('description').notNull(),
  status: text('status').$type<'open' | 'in_progress' | 'closed'>().notNull().default('open'),
  reportedAt: integer('reported_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
}, (table) => [index('defect_report_org_status_idx').on(table.organisationId, table.status)])

export const auditLog = sqliteTable('audit_log', {
  id: id(),
  organisationId: orgId(),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (table) => [index('audit_log_org_created_idx').on(table.organisationId, table.createdAt)])
