# Design system — Planetary Service

The operator UI has one visual language. It is **not** invented here: it is style 141
`planetary-service` from the local style-lab catalogue (`C:\Orca\style-lab\styles\141-planetary-service`),
chosen as a mission-desk console — deep navy ground, mono telemetry, sharp corners, one blue accent.
The catalogue entry is the authority for component sizes; this file records what the app does with it.

## Contract

| Layer | Where | Rule |
| --- | --- | --- |
| Tokens | `apps/web/app/globals.css`, `[data-style='planetary-service']` block | the only place a colour, radius, shadow, font or duration literal is allowed |
| Shell | `apps/web/app/layout.tsx` + `apps/web/app/_components/rail-nav.tsx` | 232px left rail (hidden entirely when there is no session), active item = 3px accent left bar, UTC clock in the rail foot; below 900px the rail becomes a top bar |
| Components | same stylesheet | panel, table, form, chip, LED, notice, orbit ring, toolbar |

Rules that are not negotiable:

- `<html data-style="planetary-service">` carries the token block; without it every value resolves to nothing.
- Radius is 0 everywhere except chips (`--radius-pill`). No rounded panels, no pill buttons.
- Numbers and identifiers are `--font-mono` with `font-variant-numeric: tabular-nums`; the unit is always
  written next to the value (`45 adet`, `06:00`, `105 dk`) and never implied.
- A status is never colour alone: LED (`.led ok|warn|crit`) plus label text, and a threshold crossing is
  carried by the panel border (`.card.crit`) — there is no decorative accent strip.
- `--ink-faint` is decorative only; text uses `--ink` (15.82:1 on `--bg`) or `--ink-soft` (8.91:1).
- Depth comes from the `--surface` / `--surface-2` tone step plus the 1px `--line`; shadow only on floating layers.
- Motion: enter 0.57s `cubic-bezier(.24,.72,.18,1)`, 22px rise with a 4px blur-in and 0.06s stagger;
  hover 190ms. No rotating orbit, no flashing telemetry, no parallax; `prefers-reduced-motion` neutralises everything.
- The 24px measurement grid appears **only** inside the orbit panel (`.orbit-field`); the page ground carries
  star dust, not a grid.
- The orbit ring appears once per screen and must carry real data: on `/` it shows the 7-week rotation with
  the current week lit (`cyclePosition` from `@citybus/domain`).
- Every panel shows its context and a `son güncelleme` (last update) stamp in the `.lead` line.

## Fonts

`layout.tsx` loads Inter (body) and IBM Plex Mono (display, numbers, labels) through `next/font/google`,
exposing `--font-body-face` and `--font-mono-face`. The token block composes those with a system fallback,
so the tokens stay the single source of truth for the family names. Headings are mono, because in this
language a title is an instruction, not a decoration.

## Verification

```bash
pnpm verify                                                          # lint + typecheck + test + build
node C:/Orca/style-lab/kit/style-lint.mjs apps/web --style planetary-service
```

`style-lint` reports the token block itself as `color-literal` errors — that is expected, the block is the
one legal place for literals. Every other finding is a real violation.
