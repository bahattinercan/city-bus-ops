# Docs

| File | Status | Content |
| --- | --- | --- |
| `README.md` | active | this index |
| `02-data-model.md` | active | three-layer model: operational master → generated GTFS/TODS → `x_` extensions |
| `06-deploy.md` | active | deployment, demo accounts, backup, health, upgrade |
| `legacy-domain-analysis.md` | **frozen record** | domain analysis of the 21 hand-filled sheet photos: code inventory (`9AT`, `-20`, `12.00`, `x`), operator decisions O1–O5 |
| `legacy-data-model-and-scheduler.md` | **frozen record** | old data model, rule catalogue R1–R18, rotation law F1–F5, validation design |
| `legacy-excel-io.md` | **frozen record** | real cell map of the printed weekly sheet (template v2.0), import/export rules |

The three `legacy-*` files are imported verbatim from the retired `city-bus-plan` repository
(Turkish, written 2026-10-27/11-01). They are the only surviving record of rules that exist
nowhere else: the 7-week rotation law, the standby semantics, the extra-duty codes and the
exact cell addresses of the printed sheet. Do not translate or "clean" them — a reworded
rule is a lost rule. New documents in this repo are written in English.
