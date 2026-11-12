# 02 — Data model (draft, M1 expands this)

## Three layers, one direction of truth

```
        (master)                    (generated)                 (generated)
  organisation ─┐
  depot ────────┼──►  Postgres  ──►  GTFS Schedule  ──►  GTFS-RT / TODS
  vehicle ──────┤     (our truth)   (published)         (operational export)
  driver ───────┤
  route/stop ───┤
  trip/block ───┤
  run/duty ─────┤
  roster ───────┘
```

Rule: **GTFS and TODS are export targets, never the master.** Importing them is a migration
tool. This prevents the failure mode of the previous system, where the paper sheet *was*
the database and every rule had to survive a round trip through it.

## Why standards at all

| Standard | Layer | What we get |
| --- | --- | --- |
| GTFS Schedule | published timetable | any journey planner/app can consume our service; other cities' networks can be imported |
| GTFS-RT | published realtime | universal client support (Google Maps, Transit app, stop displays) |
| TODS 2.1 | operational export | blocks, runs, deadheads, personnel, per-day vehicle assignment — the exact vocabulary for driver duty data |
| Transmodel / NeTEx | vocabulary reference | naming and relationships (`DUTY`, `BLOCK`, `ROSTER`, `DAY TYPE`) when we must invent a name |

## Extension namespace (`x_`)

The standards do not model four things that are core to the operator:

| Concept | Why not standard | Table |
| --- | --- | --- |
| Standby duty (nöbet) | Turkish operating practice; a vehicle is on standby with a route code | `x_standby` |
| 7-week rotation law (F1–F5) | Collective agreement / official rule, not a scheduling standard | `x_rotation_rule`, `x_duty_group` |
| Extra-duty codes (`-20` = additional duty on route 20) | Hand-written shorthand on the sheet | `x_extra_duty` |
| Free-text cell notes (`otogar`, `Demirci`) | Unstructured annotation by the planner | `x_cell_note` |

Every extension row keeps the **raw** text it came from (`raw` column). An unexplained code
is data, not a bug — this is how the previous system's unanswered questions
(`9AT`, `1A`, `12G`, `12P`) stop being blockers.

## Tables (M1 state)

| Group | Tables |
| --- | --- |
| Tenancy & fleet | `organisation` (holds the rotation anchor week), `depot`, `vehicle` (`source` keeps printed vs handwritten plates), `driver` |
| Network & timetable | `route`, `stop`, `route_stop`, `trip` (`start_minute` may exceed 1440 for after-midnight trips) |
| Planning | `duty_group` (`reference_day_index` = legacy `g0`), `plan_version` (draft/published/archived, one per week), `assignment` (one per vehicle-day), `standby`, `cell_note` |
| People | `roster_entry`, `absence`, `swap_request`, `defect_report`, `app_user` |
| Control | `rule_violation`, `audit_log` |

Stops currently carry `latitude`/`longitude` as text; PostGIS geometry joins when the map
editor lands. The `x_` prefix from the earlier draft applies to the **exported** GTFS
namespace only — inside our own schema these concepts are ordinary first-class tables,
because they *are* the business.

## Rule catalogue

`R1`–`R18` live in `packages/domain/src/rules/catalog.ts` with the operators' severity split
(13 hard / 5 soft). `L1`–`L5` are the new driver working-time rules (defaults from the
reference bus-driver model, pending operator confirmation). `ENFORCEMENT` in
`packages/domain/src/plan/engine.ts` records where each rule is enforced — engine or write
guard — and a test fails if a code is added without an entry.
