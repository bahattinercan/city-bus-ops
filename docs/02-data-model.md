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

## Tables (M0 state)

`organisation`, `depot`, `vehicle` — see `packages/db/src/schema.ts`. M1 adds routes, stops
(PostGIS geometry), trips, blocks, runs, duties, rosters, absences, plan versions, rule
catalogue and audit log.
