# City Bus Ops

Operations system for a municipal city-bus fleet: network and timetable, vehicle blocking,
driver duties and the weekly rotation law, driver app, and the printed weekly plan the
operator already uses.

Monorepo, TypeScript. Status: **M0–M6 complete + Windows desktop build** — network/timetable,
vehicle blocking, weekly plan with the 7-week rotation law, rule engine (R1–R18 + L1–L5),
driver records and run cutting, driver screens, Excel output in the operator's sheet layout,
audit trail, planning assistant, and an **Electron desktop app that runs entirely offline**
(embedded SQLite, no server to administer) — see `docs/09-desktop-app.md`.

| Screen | Who | What |
| --- | --- | --- |
| `/network` | planner | routes, stops, timetables per day type |
| `/plan` | planner, dispatcher | generate the week, rule panel, manual locked cell edits, publish |
| `/drivers` | planner, dispatcher | run cutting, roster, swaps, defects, absences |
| `/driver` | driver | my week, swap request, defect report |
| `/reports` | all staff | KPIs, violations, audit trail, Excel download |
| `/api/gtfs` | public | GTFS Schedule zip (validated subset) |
| `/api/health` | ops | liveness + database check |

## Why this exists

The previous system was a single-user desktop app that produced a weekly Excel sheet. It
worked but could not grow: no concurrency, no drivers, no timetable, no live data, and every
rule lived in code. This rewrite keeps the hard-won domain knowledge (7-week rotation law,
18-rule catalogue, exact printed-sheet cell map) and rebuilds the rest on open standards:
**GTFS** for the published schedule, **TODS 2.1** for operational data, and our own `x_`
extension tables for what those standards do not model.

## Requirements

| Component | Version |
| --- | --- |
| Node | 22 LTS |
| pnpm | 12 (via corepack) |
| Database | SQLite (embedded, per install) — no server, no extension |

## Quick start

```bash
pnpm install
cp .env.example .env          # fill DATABASE_URL and SESSION_SECRET
ssh -f -N -L 5435:127.0.0.1:5435 mint   # DB tunnel (this machine's setup)
pnpm db:migrate
pnpm --filter @citybus/web dev
```

Open <http://localhost:3000> and sign in. The first request seeds the Kütahya reference data
(45 plates, 12 routes, 4 duty groups), 20 demo drivers and a demo timetable.

| Account | Role |
| --- | --- |
| `admin@kutahya.local` | admin |
| `planlama@kutahya.local` | planner |
| `santral@kutahya.local` | dispatcher |
| `sofor@kutahya.local` | driver |

Password: `CITYBUS_DEMO_PASSWORD` (default `demo1234`). Deployment, backup and health
checks: `docs/06-deploy.md`.

## Verification

```bash
pnpm verify                                  # lint + typecheck + test + build
BASE=http://127.0.0.1:3000 scripts/smoke.sh  # end-to-end against a running server
```

Test accounts, seeded demo data and the walkthrough: [TESTING.md](TESTING.md).

Database integration tests run only when `DATABASE_URL` is set; otherwise they skip.

## Windows desktop build

```bash
pnpm --filter @citybus/web build          # Next standalone server
pnpm --filter @citybus/desktop package    # stages the server, compiles the shell, builds installers
```

Output in `apps/desktop/release/`: `City Bus Ops-<version>-x64.exe` (NSIS installer, ~103 MB)
and `City Bus Ops-<version>-portable.exe` (~93 MB). Data lives in
`%APPDATA%\CityBusOps\citybus.db`, credentials in `config.json` next to it, backups rotate in
`backups/`. `pnpm --filter @citybus/desktop self-test` boots the whole stack headlessly and
prints a JSON report.

## Documentation

| File | Content |
| --- | --- |
| `AGENTS.md` | working rules for this repository |
| `docs/02-data-model.md` | three-layer model, `x_` extension namespace |
| `docs/legacy-domain-analysis.md` | code inventory of the real sheets, operator decisions O1–O5 |
| `docs/legacy-data-model-and-scheduler.md` | rule catalogue R1–R18, rotation law F1–F5 |
| `docs/06-deploy.md` | deployment, accounts, backup, upgrade |
| `docs/legacy-excel-io.md` | cell map of the printed weekly sheet (template v2.0) |

The `legacy-*` documents are verbatim imports from the retired project and stay in Turkish:
they are the only surviving record of rules that exist nowhere else.

---

# City Bus Ops (Türkçe)

Belediye şehir içi otobüs filosu için operasyon sistemi: hat ve tarife, araç bloklama, şoför
görevleri ve haftalık rotasyon kuralı, şoför uygulaması ve operatörün hâlâ kullandığı basılı
haftalık plan.

Tek depo (monorepo), TypeScript. Durum: **M0–M6 tamam** — hat/tarife, araç bloklama, 7
haftalık rotasyonlu haftalık plan, kural motoru (R1–R18 + L1–L5), şoför kayıtları ve run
cutting, şoför PWA, operatörün tablo düzeninde Excel çıktısı, denetim izi, dağıtım.

| Ekran | Kim | Ne |
| --- | --- | --- |
| `/network` | planlama | hatlar, duraklar, gün tipine göre tarife |
| `/plan` | planlama, santral | haftayı üret, kural paneli, elle kilitli hücre düzenleme, yayınla |
| `/drivers` | planlama, santral | run cutting, roster, takas, arıza, izin |
| `/driver` | şoför | haftam, takas isteği, arıza bildirimi |
| `/reports` | tüm personel | KPI, ihlaller, denetim izi, Excel indirme |
| `/api/gtfs` | herkese açık | GTFS Schedule zip (doğrulanmış alt küme) |
| `/api/health` | işletim | canlılık + veritabanı kontrolü |

## Neden yeniden yazıldı

Önceki sistem tek kullanıcılı bir masaüstü uygulamasıydı ve haftalık Excel tablosunu
üretiyordu. Çalışıyordu ama büyüyemiyordu: eşzamanlı kullanım yok, şoför yok, sefer tarifesi
yok, canlı veri yok ve her kural kodun içindeydi. Bu sürüm, pahalıya öğrenilen alan bilgisini
(7 haftalık rotasyon kuralı, 18 kurallık katalog, basılı tablonun birebir hücre haritası)
koruyup geri kalanı açık standartlar üzerine kuruyor: yayımlanan tarife için **GTFS**,
operasyonel veri için **TODS 2.1**, standartların kapsamadığı kısımlar için kendi `x_`
uzantı tablolarımız.

## Windows masaüstü sürümü

```bash
pnpm --filter @citybus/web build          # Next standalone sunucusu
pnpm --filter @citybus/desktop package    # sunucuyu paketler, kabuğu derler, kurulumları üretir
```

Çıktı `apps/desktop/release/` altında: `City Bus Ops-<sürüm>-x64.exe` (NSIS kurulum, ~103 MB) ve
`City Bus Ops-<sürüm>-portable.exe` (~93 MB). Veri `%APPDATA%\CityBusOps\citybus.db` dosyasında,
giriş bilgileri yanındaki `config.json` içinde, yedekler `backups/` klasöründe döner.

## Gereksinimler

| Bileşen | Sürüm |
| --- | --- |
| Node | 22 LTS |
| pnpm | 12 (corepack) |
| Veritabanı | SQLite (gömülü, kurulum başına) — sunucu ve eklenti yok |

## Hızlı başlangıç

```bash
pnpm install
cp .env.example .env          # DATABASE_URL doldur
ssh -f -N -L 5435:127.0.0.1:5435 mint   # veritabanı tüneli (bu makinenin kurulumu)
pnpm db:migrate
pnpm --filter @citybus/web dev
```

<http://localhost:3000> adresini aç. Ana sayfa yol haritası panosu ve paketlerin doğru
bağlandığını gösteren canlı kontrol listesidir.

## Doğrulama

```bash
pnpm verify                                  # lint + typecheck + test + build
BASE=http://127.0.0.1:3000 scripts/smoke.sh  # çalışan sunucuya karşı uçtan uca
```

Test hesapları, demo veri ve elle gezinme: [TESTING.md](TESTING.md).

Veritabanı entegrasyon testleri yalnız `DATABASE_URL` tanımlıysa koşar, aksi halde atlanır.

## Dokümanlar

| Dosya | İçerik |
| --- | --- |
| `AGENTS.md` | bu deponun çalışma kuralları |
| `docs/02-data-model.md` | üç katmanlı model, `x_` uzantı alanı |
| `docs/legacy-domain-analysis.md` | gerçek tabloların kod envanteri, O1–O5 kararları |
| `docs/legacy-data-model-and-scheduler.md` | R1–R18 kural kataloğu, F1–F5 rotasyon kuralı |
| `docs/06-deploy.md` | dağıtım, hesaplar, yedekleme, yükseltme |
| `docs/legacy-excel-io.md` | basılı haftalık tablonun hücre haritası (şablon v2.0) |

`legacy-*` dokümanları emekli projeden birebir alınmıştır ve Türkçe kalır: başka yerde
bulunmayan kuralların tek kaydıdır.
