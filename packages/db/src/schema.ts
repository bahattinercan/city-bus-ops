import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { DayType } from '@citybus/domain'

/**
 * Operational master schema (layer 1 of 3).
 *
 * Layer 2 (GTFS / GTFS-RT / TODS) is generated from this and never hand-edited.
 * Layer 3 is the extension namespace for rules the standards do not model; those live
 * here as first-class tables (`standby`, `extra_duty`, `cell_note`) and are exported
 * under an `x_` prefix. See docs/02-data-model.md.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const organisations = pgTable('organisation', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull().default('TR'),
  timeZone: text('time_zone').notNull().default('Europe/Istanbul'),
  /** Monday of the week the 7-week rotation counts from (legacy `Rotation:AnchorWeek`). */
  rotationAnchorWeek: date('rotation_anchor_week', { mode: 'string' }).notNull().default('2026-09-21'),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('organisation_slug_key').on(table.slug)])

export const depots = pgTable('depot', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
}, (table) => [uniqueIndex('depot_org_code_key').on(table.organisationId, table.code)])

export const vehicles = pgTable('vehicle', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  depotId: uuid('depot_id').references(() => depots.id, { onDelete: 'set null' }),
  /** 3-digit fleet number as printed on the plan: '003', '134'. */
  plateNumber: text('plate_number').notNull(),
  capacity: integer('capacity'),
  lowFloor: boolean('low_floor').notNull().default(false),
  airConditioned: boolean('air_conditioned').notNull().default(false),
  /** 'printed' | 'handwritten' — legacy decision O5 kept `221`/`085` and `229`/`225` both in the fleet. */
  source: text('source').$type<'printed' | 'handwritten'>().notNull().default('printed'),
  status: text('status').$type<'active' | 'maintenance' | 'retired'>().notNull().default('active'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('vehicle_org_plate_key').on(table.organisationId, table.plateNumber),
  index('vehicle_org_status_idx').on(table.organisationId, table.status),
])

export const drivers = pgTable('driver', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  employeeNo: text('employee_no').notNull(),
  fullName: text('full_name').notNull(),
  licenceClass: text('licence_class').notNull().default('D'),
  /** Higher = more senior; used when a duty has to be picked manually. */
  seniority: integer('seniority').notNull().default(0),
  /** Rule the driver is bound to; drives roster generation. */
  homeDepotId: uuid('home_depot_id').references(() => depots.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('driver_org_employee_key').on(table.organisationId, table.employeeNo)])

export const users = pgTable('app_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<'admin' | 'planner' | 'dispatcher' | 'driver'>().notNull(),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('app_user_email_key').on(table.email)])

export const routes = pgTable('route', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  /** Operator code: '5', '9AT', '26A'. Letter suffixes keep the operator's meaning. */
  code: text('code').notNull(),
  name: text('name').notNull(),
  requiredLowFloor: boolean('required_low_floor').notNull().default(false),
  requiredAc: boolean('required_ac').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('route_org_code_key').on(table.organisationId, table.code)])

export const stops = pgTable('stop', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  /** WGS84. PostGIS geometry arrives with the map editor (M2 follow-up). */
  latitude: text('latitude'),
  longitude: text('longitude'),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('stop_org_code_key').on(table.organisationId, table.code)])

export const routeStops = pgTable('route_stop', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  stopId: uuid('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  direction: integer('direction').notNull().default(0),
  sequence: integer('sequence').notNull(),
}, (table) => [
  uniqueIndex('route_stop_key').on(table.routeId, table.direction, table.sequence),
])

export const trips = pgTable('trip', {
  id: uuid('id').primaryKey().defaultRandom(),
  routeId: uuid('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  dayType: text('day_type').$type<DayType>().notNull(),
  /** Minutes after midnight; may exceed 1440 for a trip after midnight. */
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  crossesMidnight: boolean('crosses_midnight').notNull().default(false),
  createdAt: createdAt(),
}, (table) => [index('trip_route_daytype_start_idx').on(table.routeId, table.dayType, table.startMinute)])

export const tripStopTimes = pgTable('trip_stop_time', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  stopId: uuid('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  /** Minutes after midnight; may exceed 1440 after midnight. */
  arrivalMinute: integer('arrival_minute').notNull(),
  departureMinute: integer('departure_minute').notNull(),
}, (table) => [uniqueIndex('trip_stop_time_key').on(table.tripId, table.sequence)])

/** A duty group's weekday moves through the week (rotation law F1-F5). */
export const dutyGroups = pgTable('duty_group', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  vehicleCount: integer('vehicle_count').notNull(),
  /** Weekday of the group in the rotation anchor week (legacy `g0`), Monday = 1. */
  referenceDayIndex: integer('reference_day_index').notNull(),
}, (table) => [uniqueIndex('duty_group_org_code_key').on(table.organisationId, table.code)])

export const planVersions = pgTable('plan_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  /** Monday of the planned week. */
  weekStart: date('week_start', { mode: 'string' }).notNull(),
  /** Whole weeks since the rotation anchor week (legacy `w`). */
  weekOffset: integer('week_offset').notNull(),
  status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('draft'),
  /** Printed weekly total on the sheet, when it is known (legacy `=76`). */
  reportedWeeklyVehicleDays: integer('reported_weekly_vehicle_days'),
  note: text('note'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('plan_version_org_week_key').on(table.organisationId, table.weekStart),
  index('plan_version_org_status_idx').on(table.organisationId, table.status),
])

export const assignments = pgTable('assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  status: text('status').$type<'duty' | 'standby' | 'idle' | 'unavailable'>().notNull(),
  dutyGroupId: uuid('duty_group_id').references(() => dutyGroups.id, { onDelete: 'set null' }),
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  /** Extra duty code (`-20`): an additional duty on another route (legacy S14). */
  extraDutyRouteId: uuid('extra_duty_route_id').references(() => routes.id, { onDelete: 'set null' }),
  /** First departure that day, minutes after midnight (legacy S15). */
  firstTripMinute: integer('first_trip_minute'),
  /** The cell text exactly as the operator wrote it. */
  rawCode: text('raw_code'),
  locked: boolean('locked').notNull().default(false),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('assignment_plan_day_vehicle_key').on(table.planVersionId, table.dayIndex, table.vehicleId),
  index('assignment_plan_group_idx').on(table.planVersionId, table.dutyGroupId),
])

export const standbys = pgTable('standby', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  /** Null means the printed code is not in the route dictionary — publishing is blocked (R9). */
  routeId: uuid('route_id').references(() => routes.id, { onDelete: 'set null' }),
  rawCode: text('raw_code').notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex('standby_plan_vehicle_key').on(table.planVersionId, table.vehicleId)])

/** Free-text handwriting on the sheet (`otogar`, `Demirci`) — kept, never interpreted. */
export const cellNotes = pgTable('cell_note', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index'),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  text: text('text').notNull(),
  createdAt: createdAt(),
})

export const absences = pgTable('absence', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  dateFrom: date('date_from', { mode: 'string' }).notNull(),
  dateTo: date('date_to', { mode: 'string' }).notNull(),
  type: text('type').$type<'leave' | 'sick' | 'maintenance' | 'other'>().notNull(),
  note: text('note'),
  createdAt: createdAt(),
}, (table) => [index('absence_org_range_idx').on(table.organisationId, table.dateFrom, table.dateTo)])

export const rosterEntries = pgTable('roster_entry', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  drivingMinutes: integer('driving_minutes').notNull().default(0),
  breakMinutes: integer('break_minutes').notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('roster_entry_plan_day_driver_key').on(table.planVersionId, table.dayIndex, table.driverId),
  index('roster_entry_plan_vehicle_idx').on(table.planVersionId, table.dayIndex, table.vehicleId),
])

export const ruleViolations = pgTable('rule_violation', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  severity: text('severity').$type<'hard' | 'soft'>().notNull(),
  message: text('message').notNull(),
  dayIndex: integer('day_index'),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'cascade' }),
  dutyGroupId: uuid('duty_group_id').references(() => dutyGroups.id, { onDelete: 'cascade' }),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('rule_violation_plan_code_idx').on(table.planVersionId, table.code)])

export const swapRequests = pgTable('swap_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  planVersionId: uuid('plan_version_id').notNull().references(() => planVersions.id, { onDelete: 'cascade' }),
  dayIndex: integer('day_index').notNull(),
  fromDriverId: uuid('from_driver_id').notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  toDriverId: uuid('to_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  status: text('status').$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  note: text('note'),
  decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index('swap_request_plan_status_idx').on(table.planVersionId, table.status)])

export const defectReports = pgTable('defect_report', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  driverId: uuid('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  severity: text('severity').$type<'low' | 'medium' | 'high'>().notNull().default('medium'),
  description: text('description').notNull(),
  status: text('status').$type<'open' | 'in_progress' | 'closed'>().notNull().default('open'),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (table) => [index('defect_report_org_status_idx').on(table.organisationId, table.status)])

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  payload: jsonb('payload'),
  createdAt: createdAt(),
}, (table) => [index('audit_log_org_created_idx').on(table.organisationId, table.createdAt)])
