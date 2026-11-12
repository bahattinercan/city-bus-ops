# 03 — Veri Modeli ve Çizelgeleme Tasarımı

> **Son güncelleme:** 2026-10-27 (kullanıcı onayları O1–O4 işlendi).

| Alan | Değer |
| --- | --- |
| Doküman | `docs/03-data-model-and-scheduler.md` |
| Durum | Taslak v1 — M1 ve M3 için teknik tasarım; O1–O5 onaylandı (2026-10-27, §0); NÖBET semantiği H4 ile işlendi (docs/01 §4.1, TD-37/TD-38); NÖBET kodu = **hat kodu** onaylandı (2026-10-27, TD-39); kalan tek belirsizlik `×` gün sınırı; diğer varsayımlar bkz. §11 |
| Kapsam | Kavramsal model, fiziksel şema, EF Core eşlemesi, kural kataloğu, rotasyon, üretim algoritması, doğrulayıcı, içe aktarma, test planı |
| Kapsam dışı | UI ekran mockup'ı (02-architecture §3), Excel şablon eşlemesi (04-excel-io), kod/migration üretimi |
| Girdi | `docs/01-domain-analysis.md` §3–§10, `docs/02-architecture.md` §2/§5/§10/ADR-007, `docs/05-roadmap.md` §2 (M1, M3) |
| Son güncelleme | 2026-10-27 (kullanıcı onayları O1–O4 işlendi) |
| Bağlayıcılık | `docs/01` ve `docs/02` bu doküman tarafından **değiştirilmez**; çelişki varsa §11 ve §12'de işaretlenir |

**Etiket sözleşmesi.** Her karar satırında `Kaynak` kolonu vardır:

| Etiket | Anlam |
| --- | --- |
| `docs/01 §n` / `docs/02 §n` | Karar kaynak dokümandan geliyor; uydurma yok |
| `TD-nn` | **Tasarım kararı**: kaynak dokümanlarda yok, bu dokümanda gerekçesiyle üretildi (§2.2 kayıt tablosu) |
| `varsayım` | Veri belirsiz; seçilen değer geçici, §11'de "kullanıcı onayı gerekli" |

---

## 0) Kullanıcı onayları (2026-10-27) ve şema etkisi

Kullanıcı 2026-10-27'de O1–O4 kararlarını onayladı. Aşağıdaki tablo her onayın bu dokümandaki şema/tasarım etkisini ve dokunulan bölümleri tek satırda verir. O5 (S6/S7) **onaylandı (2026-10-27): filo 45 plaka**; `arac.kaynak` kolonu ve TD-36 bu kararla eklendi.

**H4 (2026-10-27, `docs/01` §4.1):** NÖBET semantiği doğrulandı — Tip B'de `×` o plakanın **nöbet günüdür** (varlık/yokluk eşleşmesi 41/41), Tip A matrisin en sağ `NÖBET` kolonu o günün **kodudur** (kod eşleşmesi 33/33). Şema etkisi: `nobet.sayi` → `nobet_kodu` (TD-37), `nobet.gun_id` → `nobet_gunu` + `nobet.kaynak_tablo` (TD-38); R9 **Sert**. **ONAYLANDI (2026-10-27): kod = hat kodu** (TD-39); çözülemeyen kod planı bloke eder.

| Kod | Karar | Şemaya etkisi | Etkilenen bölümler |
| --- | --- | --- | --- |
| **O1** (S1) | Hücredeki tek rakam kodlar (`2`,`5`,`6`,`7` …) = **hat numarası**; sefer sayısı değil | `atama.hat_no` kolonu eklendi (TD-30); hat sözlüğünde karşılığı varsa `hat_id` de dolar; `atama.sefer_sayisi` hücreden **türetilmez**, yalnızca manuel/hesaplanan alan (TD-31) | §2.1, §2.2 (TD-06, TD-30, TD-31), §3.2.7, §4.2, §5 (R4, §5.1), §9.3, §11 S1 |
| **O2** (S9) | Esas kaynak **Tip B** (gün = kolon, plaka = dikey liste); Tip A matrisi ikincil | Şema değişmez; içe aktarma sırası ve çelişki kuralı tersine döner: `I-06` artık Tip B'yi kazandırır (TD-35) | §9.1, §9.2 (I-06), §9.5, §11 S9 |
| **O3** | Hücredeki `x` = **nöbet işareti** (iptal değil) | `nobet.tip = 3 (NobetIsareti)` + yeni `nobet.kaynak` kolonu (0=Hücre, 1=Manuel) (TD-32); `atama.durum = Iptal` yalnızca elle işaretlenebilir (TD-33) | §2.1, §2.2, §2.3, §3.2.7, §3.2.9, §5 (R9), §9.3, §11 S10 |
| **O4** (S20) | 7 haftalık görev grubu–gün kayması **resmî kural** | Şema değişmez; `R7` Yumuşak → **Sert** (TD-34); rotasyon formülü (F3) bağlayıcı | §5 (R7, dağılım), §6.1, §7.3, §8.2, §8.5, §11 S20, §13 |
| **O5** | S6/S7 (`221`/`229`, `085`/`225`) **ONAYLANDI (2026-10-27): 45 plaka** — elle yazılan `229` ve `225` geçerli ek kayıt, basılı `221` ve `085` de listede kalır | `arac.kaynak` kolonu: `kaynak TEXT NOT NULL DEFAULT 'basili' CHECK (kaynak IN ('basili','elle'))` (TD-36); `arac` seed 45 satır | §2.2 (TD-36), §3.2.1, §3.5, §9.5, §11 S6, S7 |

Kurallar:

| # | Kural |
| --- | --- |
| 1 | §0 yalnızca bu dokümanın tasarım kararlarını (TD) günceller; `docs/01`/`docs/02` değiştirilmez. |
| 2 | Her onay için TD kaydı açıldı (TD-30…TD-36); mevcut TD numaraları silinmedi, yalnızca gerekçesi güncellendi. |
| 3 | O5 kapsamındaki S6/S7 satırları **ONAYLANDI (2026-10-27)**: 45 plaka; elle yazılan `229`/`225` ek kayıt, `221`/`085` basılı kalır (TD-36). |

---

## 1) Amaç ve kapsam

### 1.1 Amaç

Bu doküman iki fazın teknik tasarımıdır:

| Faz | Kapsam (docs/05 §2) | Bu dokümandaki karşılığı |
| --- | --- | --- |
| **M1** Domain ve veri | Varlıklar, SQLite + migration, 41 plakalık filo seed | §2 kavramsal model, §3 fiziksel şema, §4 EF Core eşlemesi |
| **M3** Çizelgeleme motoru | Kurallar, haftalar arası rotasyon, doğrulayıcı | §5 kural kataloğu, §6 rotasyon, §7 üretim, §8 doğrulayıcı |

M2 (Excel içe aktarma) bu dokümanda yalnızca **veri sözleşmesi** düzeyinde ele alınır (§9); Excel okuma/yazma ayrıntısı `04-excel-io.md` konusudur.

### 1.2 Bu dokümanın cevapladığı sorular

| # | Soru | Bölüm |
| --- | --- | --- |
| 1 | Hangi tablo, hangi kolon, hangi tip? | §3 |
| 2 | EF Core'da nasıl eşlenir, migration nasıl yönetilir? | §4 |
| 3 | Planlama kuralları neler, hangisi bloke eder? | §5, §8 |
| 4 | 7 haftalık rotasyon formülü nedir? | §6 |
| 5 | Plan nasıl üretilir, tekrar üretilebilir mi? | §7 |
| 6 | Eski tablodan veri nasıl çıkarılır, belirsizlik nasıl işaretlenir? | §9 |
| 7 | Neyi test edeceğiz? | §10 |
| 8 | Hangi varsayım kullanıcı onayı bekliyor? | §11 |

### 1.3 Kapsam dışı (bilinçli)

| # | Konu | Gerekçe |
| --- | --- | --- |
| 1 | Şoför/personel tabloları, vardiya hakkı, maaş | `docs/05` §4 K2 ve §6/1: v1 yalnızca araç-atama planı üretir. Şoför alanı açılmaz. |
| 2 | Excel hücre adresi eşlemesi, şablon doldurma | `docs/02` §4.3 ve ADR-011; ayrı doküman (`04-excel-io.md`). |
| 3 | UI ekran tasarımı, grid sanallaştırma | `docs/02` §3.3 / ADR-005. Burada yalnızca ihlal gösterimi sözleşmesi var (§8.4). |
| 4 | Çok kullanıcı, sunucu, senkronizasyon | `docs/02` §5.2: tek makine, tek kullanıcı, WAL. |
| 5 | Canlı GPS / sefer gerçekleşme takibi | `docs/05` §6/2. |
| 6 | Tam CSP/ILP çözücü entegrasyonu | §7.7 kararı: v1'de yok, port bırakıldı. |

### 1.4 Tasarım ilkeleri (bu dokümanın bağlayıcı kabulü)

| # | İlke | Sonuç |
| --- | --- | --- |
| P1 | Şema, `docs/01` §8'deki alan adlarını **korur**; yalnızca gerekçeli düzeltme yapar | §2.1 tablosunda her varlık için "korundu/değişti" kararı var |
| P2 | Belirsiz veri **silinmez**, işaretlenir (`varsayim_mi`, `kaynak`, `not_metni`) | §9.2 normalizasyon tablosu |
| P3 | Kural ihlali **hesaplanır**, plan verisiyle karışmaz | `kural_ihlali` yalnızca snapshot (§3.2.13) |
| P4 | Üretim **deterministik**: aynı girdi + aynı seed → aynı plan | §7.5 |
| P5 | Elle yapılan düzeltme motor tarafından **ezilmez** | R8 + `atama.kilitli` |
| P6 | Fiziksel silme yok (`docs/02` §5.2) | `silindi_mi` + `ON DELETE RESTRICT` |

---

## 2) Kavramsal model

### 2.1 `docs/01` §8 varlıklarının gözden geçirilmesi

`docs/01` §8 on varlık öneriyor. Aşağıda her biri için karar ve tek satır gerekçe var.

| # | Varlık (docs/01 §8) | docs/01'deki alanlar | Karar | Gerekçe (tek satır) |
| --- | --- | --- | --- | --- |
| 1 | **Arac** | `arac_id`, `plaka`, `filo_no`, `tip`, `aktif`, `gorsel_ref` | **Değişti** | `plaka` ile `filo_no` aynı değeri taşıyor (docs/01 §5: "numara, plakanın son 3 hanesidir") → tekilleştirildi (TD-01); `aktif` tek bayrak yerine `durum` + `silindi_mi` ayrıldı (TD-02); `gorsel_ref` kaynak izi `atama`/`duzeltme` üzerinden FK'ye taşındı (TD-17). |
| 2 | **Hat** | `hat_id`, `hat_kodu`, `hat_no`, `varyant`, `ad`, `aktif` | **Daraltıldı** | O1 (2026-10-27): tek rakam kodlar (`2`,`5`,`6`,`7` …) artık **hat numarasıdır** → `hat_no`/`atama.hat_no` (TD-30); `5x`, `-20`, `A`, `S` gibi bileşik kodlar hâlâ hat değil (docs/01 §3); `hat` yalnızca gerçek güzergâhı tutar, ham kod `atama.gorev_kodu_ham`'da saklanır (TD-08). |
| 3 | **Sefer** | `sefer_id`, `hat_id`, `baslangic_saat`, `bitis_saat`, `gun_tipi`, `sure_dk`, `yon` | **Korundu + genişledi** | Alanlar aynı; gece yarısını aşan sefer için `gun_kaymasi` eklendi (docs/02 R6; TD-15). |
| 4 | **Gun** | `gun_id`, `tarih`, `gun_adi`, `hafta_id`, `gun_tipi` | **Korundu + daraltıldı** | `gun_adi` yerine `gun_sirasi` (1–7) tutuldu: Türkçe gün adı UI metnidir (docs/02 §3.4, metin kaynağı `Resources/`), veri değildir (TD-24). |
| 5 | **Hafta** | `hafta_id`, `baslangic`, `bitis`, `sezon`, `döngü_sırası`, `toplam_arac_gun` | **Korundu + kural eklendi** | `döngü_sırası` 1–7 olarak CHECK'lendi; `toplam_arac_gun` yalnızca içe aktarılan haftalarda snapshot, üretimde hesaplanır (TD-14). |
| 6 | **Atama** | `atama_id`, `hafta_id`, `gun_id`, `arac_id`, `hat_id`, `sefer_id`, `vardiya`, `sefer_sayisi`, `durum`, `gorev_grubu`, `kaynak_gorsel`, `elle_duzeltme` | **Değişti** | `sefer_id` tekil alan bir günde N sefere yetmiyor → `atama_sefer` alt tablosu (TD-06); hücreden gelen tek rakam artık **hat numarası** olduğu için `atama.hat_no` eklendi (TD-30) ve `sefer_sayisi` hücreden türetilmiyor (TD-31); `vardiya` metni `vardiya_id` FK'sine döndü (TD-09); `durum` 3 değerden 6 değere genişledi (TD-03), `Iptal` yalnızca elle işaretlenir (TD-33); `elle_duzeltme` yanına `kilitli` eklendi (TD-07). |
| 7 | **Nobet** | `nobet_id`, `tarih`, `arac_id`, `tip`, `sayi`, `kaynak_gorsel` | **Değişti (koordinatör kararı + O3 + H4)** | Nöbet **ayrı varlık** kalır, Vardiya ile birleştirilmez; `tarih` yerine `hafta_id + nobet_gunu` (TD-09, TD-38); hücredeki `x` artık nöbet işaretidir → `tip = 3 (NobetIsareti)` + `kaynak` kolonu (TD-32); H4 (2026-10-27): `NÖBET` kolonu sayı değil **kod** taşır → `sayi` yerine `nobet_kodu TEXT` (TD-37) + `kaynak_tablo` (matris/rotasyon, TD-38); NÖBET kodu = **hat kodu** onaylandı (2026-10-27, TD-39), `hat_id` çözümü zorunlu. |
| 8 | **GorevGrubu** | `grup_id`, `ad`, `arac_sayisi`, `sorumlu` | **Korundu + normalizasyon** | Parantez içi sayı araç sayısıdır (docs/01 §3), grup kimliği değil; okuma varyantları (`B.Evler`/`B.Çukur`/`S.B.Çukur`) `takma_adlar` alanında toplanır (TD-10). |
| 9 | **Duzeltme** | `duzeltme_id`, `atama_id`, `tur`, `eski_deger`, `yeni_deger`, `gorsel_ref`, `tarih` | **Korundu + kaynak ayrımı** | `kaynak` alanı eklendi (`Gorsel` / `Kullanici`): içe aktarılan iz ile kullanıcının uygulamada yaptığı düzeltme aynı denetim izinde karışmasın (TD-12). |
| 10 | **GorselKaynak** | `gorsel_id`, `dosya_adi`, `tablo_tipi`, `hafta_id`, `okunabilirlik`, `mukerrer_mi` | **Korundu + öz-ilişki** | `mukerrer_kaynak_id` eklendi: docs/01 §1.1'deki 5 mükerrer çekim (G10=G08, G12=G11, G19/G20=G18, G09=G07) tekrar sayılmasın. |

**Eklenen varlıklar (kaynak dokümanlarda tablo olarak yok):**

| # | Varlık | Kaynak | Gerekçe |
| --- | --- | --- | --- |
| 11 | **Vardiya** (Shift) | `docs/02` §2.2 (`Entities/Shift.cs`), `docs/01` §8 `Atama.vardiya` | `A`/`S` vardiya tanımı (hizmet aralığı) tek yerde tutulur; atama ve nöbet bu tanıma FK ile bağlanır (TD-09). |
| 12 | **AtamaSefer** | TD-06 | Bir atama N sefer içerir; hangi seferin hangi araçta olduğu izlenebilir olmalı. |
| 13 | **Uretim** | TD-11 | Determinizm kanıtı: seed, motor sürümü, kural ağırlıkları, süre kaydı. |
| 14 | **KuralIhlali** | TD-12 | Doğrulayıcı çıktısı kalıcı ve sorgulanabilir olmalı (UI listesi + Excel hata raporu). |

### 2.2 Tasarım kararı kayıtları (TD)

Her satır tek gerekçe; ayrıntı ilgili bölümde.

| ID | Karar | Gerekçe (tek satır) |
| --- | --- | --- |
| TD-01 | `plaka` tek alan (3 hane) + `plaka_tam` opsiyonel; `filo_no` kaldırıldı | docs/01 §5: okunan numaralar plakanın son 3 hanesidir; iki alan aynı veriyi tutuyordu. |
| TD-02 | `arac.durum` (operasyonel) ve `arac.silindi_mi` (kayıt) ayrı | docs/02 §5.2 fiziksel silmeyi yasaklar; "hizmet dışı araç" ile "silinmiş kayıt" farklı kavram. |
| TD-03 | `atama.durum` = `Gorevli, Yat, Iptal, Izinli, Arizali, Bakim` | docs/01 §8 üç değer veriyor, docs/01 §7 düzeltme tipolojisi (a) "araç devre dışı" için neden ayrımı gerektiriyor. |
| TD-04 | `YAT` ayrı tablo değil, `atama.durum = Yat` | docs/01 §8 tasarım notu: YAT satırı yalnızca "o gün görev yok" demek. |
| TD-05 | `atama` içinde `hafta_id` **ve** `gun_id` birlikte | `UNIQUE(hafta_id, gun_id, arac_id)` kısıtı ve hafta bazlı sorgu için; `gun_id` haftayı zaten belirler, CHECK ile tutarlılık denetlenir. |
| TD-06 | `atama_sefer` alt tablosu | Bir atama N sefer içerir ve hangi seferin hangi araçta olduğu izlenmelidir; O1 (2026-10-27) sonrası hücredeki tek rakam hat numarasıdır, bu karar yalnızca alt tablonun varlığını gerekçeler (bkz. TD-30, TD-31). |
| TD-07 | `atama.kilitli` bayrağı | R8 (elle düzeltme korunur) yalnızca "elle yapıldı" bilgisiyle uygulanamaz; motorun dokunmayacağı hücre açıkça işaretlenmeli. |
| TD-08 | Hat yalnızca gerçek güzergâh; `5x`/`-20`/`A`/`S` hat sayılmaz | docs/01 §3 ve §9/1–3: bu kodların hat olup olmadığı belirsiz; şemayı belirsizliğe kilitlememek için ham kod ayrı kolonda. |
| TD-09 | `Nobet` ve `Vardiya` ayrı iki varlık | Koordinatör kararı (2026-10-27): iki kavram birleştirilmeden ayrı modellenir. Sözlük çelişkisi kapatıldı: `docs/00` v2 (2026-10-27) NOBET/VARDİYA ayrımını bu karara göre tanımlar. |
| TD-10 | `gorev_grubu.ad` + `arac_sayisi` + `takma_adlar` | docs/01 §6.1: aynı grup farklı adlarla yazılmış, parantez içi sayı sabit → sayı araç sayısıdır. |
| TD-11 | `uretim` tablosu | Determinizm (P4) yalnızca seed saklanırsa kanıtlanabilir; ayrıca süre ölçümü performans hedefinin kanıtı. |
| TD-12 | `kural_ihlali` snapshot + `duzeltme.kaynak` | docs/02 §3.2 "kural ihlali vurgusu" UI'da gösterilecek; ihlal her seferinde yeniden hesaplanırsa onaylanmış planın geçmişi değişir. |
| TD-13 | `hafta.dongu_sirasi` hem saklanır hem türetilir | docs/01 §8 alanı zaten öneriyor; türetilen değerle karşılaştırma rotasyon kuralının (R7) canlı denetimi olur. |
| TD-14 | `toplam_arac_gun` yalnızca içe aktarımda dolu | docs/01 §10: bu değer "hesaplanmalı"; içe aktarılan haftada ise tablodaki `=76` ile karşılaştırma kanıtı olarak saklanır. |
| TD-15 | `sefer.gun_kaymasi` ve `vardiya.gun_kaymasi` | docs/02 R6: 24:00'ı aşan vardiya için `TimeOnly` tek başına yetmez. |
| TD-16 | Enum'lar `INTEGER` + `CHECK` olarak saklanır | Kompakt, indekslenebilir, EF Core varsayılanı; okunabilirlik view/UI katmanında sağlanır (metin enum'da yazım hatası riski). |
| TD-17 | `atama.kaynak_gorsel_id` FK | docs/01 §8 `kaynak_gorsel` alanı serbest metin değil, `G01`…`G21` referansı (docs/01 §1). |
| TD-18 | Tarih/saat `TEXT` ISO-8601 | docs/02 §5.2 kararı; SQLite'ta `DateOnly`/`TimeOnly` için tek tutarlı yol. |
| TD-19 | `RowVersion` yok; iyimser `guncelleme_zamani` + tek yazar kilidi | docs/02 §5.2: tek kullanıcı; SQLite'ta satır sürümü sütunu yerleşik değil, `SemaphoreSlim` yeterli. |
| TD-20 | Tek migration seti; seed ayrı `HasData`/SQL betiği | docs/02 §5.3; seed'in migration içine gömülmesi geri alma ve test tekrarını zorlaştırır. |
| TD-21 | `ON DELETE RESTRICT` (iki alt tablo hariç `CASCADE`) | P6: plan geçmişi bozulmasın; `atama_sefer` ve `kural_ihlali` saf detay olduğu için üst kaydıyla birlikte gider. |
| TD-22 | Şoför varlığı yok | docs/05 §4 K2 ve §6/1: v1 araç planı üretir; şoför şeması sonradan eklenirse `atama`ya nullable FK ile eklenir. |
| TD-23 | Rotasyon referans haftası `2026-09-21` (config) | docs/01 §6.1 tablosunda dört grubun da okunabildiği en net hafta; sabit kodlanmaz, ayardan gelir. |
| TD-24 | `gun_adi` yerine `gun_sirasi` | Gün adı Türkçe UI metnidir (docs/02 §3.4), veri değildir; sıra sayısı hem sıralama hem rotasyon formülü için gerekli. |
| TD-25 | İçe aktarma karantinası `kural_ihlali` içinde `I-` kodlarıyla | Yeni tablo açmadan belirsiz/okunamayan satır izlenebilir kalır; rapor aynı sorguyla üretilir. |
| TD-26 | Gün entity adı `PlanningDay` | `Day` BCL'de `DayOfWeek`/`System.Linq` ile karışıyor; `Gun` okunabilirliği düşürüyor. |
| TD-27 | `gorev_grubu.referans_gun` kolonu | Rotasyon formülünün `g0` başlangıç değeri hesaplanamaz, docs/01 §6.1 tablosundan veri olarak okunur. |
| TD-28 | `IPlanOptimizer` portu (Application katmanı) | Greedy+repair bugünkü karar; ileride ILP/CSP eklenirse yalnızca implementasyon değişir, şema ve Domain sabit kalır. |
| TD-29 | Tip A / Tip B çelişki önceliği (I-06) | İki tablo aynı bilgiyi farklı taşıyor (docs/01 §9/9); hangi alanın hangi kaynaktan geldiği yazılı olmadan aktarım tekrarlanamaz. **O2 (2026-10-27) ile öncelik tersine döndü → TD-35.** |
| TD-30 | Hücredeki tek rakam kod (`2`,`5`,`6`,`7` …) = **hat numarası**; `atama.hat_no` kolonu eklendi | O1 (kullanıcı onayı 2026-10-27): kod sefer sayısı değil hat numarası; hat sözlüğünde karşılığı olmasa da numara kaybolmasın diye `hat_no` ayrıca saklanır. |
| TD-31 | `atama.sefer_sayisi` hücreden **türetilmez**; yalnızca manuel giriş veya `atama_sefer` sayımından hesaplanır | O1: hücre artık sefer sayısı taşımıyor; tek gerçek kaynak `atama_sefer` satırlarıdır, alan hızlı okuma/rapor için türetilmiş önbellektir. |
| TD-32 | `x` hücresi → `nobet(tip = 3 NobetIsareti, kaynak = 0 Hücre)`; `nobet.kaynak` kolonu eklendi | O3 (kullanıcı onayı): `x` iptal değil nöbet işaretidir; işaretin hücreden mi elle mi geldiği denetim izinde ayrılmalı. |
| TD-33 | `atama.durum = Iptal` yalnızca **elle** işaretlenebilir (`elle_duzeltme = 1`); hücreden `Iptal` üretilmez | O3: `x` artık iptal anlamı taşımıyor; kalan tek iptal kaynağı üstü çizik (`×253`) ve kullanıcı işareti, ikisi de elle doğrulanır. |
| TD-34 | `R7` (7 haftalık rotasyon) **Yumuşak → Sert** | O4 (kullanıcı onayı): 7 haftalık görev grubu–gün kayması resmî kuraldır; ihlal onayı bloke eder. |
| TD-35 | `I-06` çelişki önceliği: **Tip B esas**, Tip A çapraz doğrulama | O2 (kullanıcı onayı): esas kaynak gün = kolon / plaka = dikey liste olan Tip B'dir; matris ikincildir (TD-29'u günceller). |
| TD-36 | `arac.kaynak` kolonu: `kaynak TEXT NOT NULL DEFAULT 'basili' CHECK (kaynak IN ('basili','elle'))` | O5 (kullanıcı onayı 2026-10-27): filo **45 plakadır**; elle yazılan `229` ve `225` geçerli ek kayıttır, basılı `221`/`085` listede kalır. Kaynağın `0/1` yerine okunabilir metin olarak tutulması import raporunda ve pilot hafta karşılaştırmasında hangi plakanın elle geldiğini doğrudan gösterir. Risk: `229`, `221`'in yerine geçen bir düzeltme ise filo 44'e düşer; pilot hafta (G02) elle karşılaştırmasında teyit edilecek. |
| TD-37 | `nobet.sayi` → `nobet_kodu` (`TEXT(10)`, nullable) | H4 (`docs/01` §4.1, kod eşleşmesi 33/33 = %100): `NÖBET` kolonundaki değer sayı değil, nöbet gününde geçerli **koddur** (`×5` → `5`, `6⊗` → `6`, `×20×` → `20`); INTEGER `sayi` kodu metin biçimiyle (baştaki sıfır, sonek) taşıyamaz, bu yüzden `nobet_kodu TEXT NULL` olarak tutulur. |
| TD-38 | `nobet.gun_id` → `nobet_gunu` (FK → `gun`, nullable) + yeni `nobet.kaynak_tablo TEXT CHECK IN ('matris','rotasyon')` | H4: nöbetin **günü** ile **kodu** iki ayrı tablo tipinden gelir (Tip B `×` → `kaynak_tablo='rotasyon'`, `nobet_gunu` dolu; Tip A `NÖBET` kolonu → `kaynak_tablo='matris'`, `nobet_kodu` dolu, gün NULL); alan adı `nobet_gunu` olarak kendini açıklar. `kaynak` adı TD-32'de (0=Hücre/1=Manuel işaret kaynağı) kullanıldığı için çakışma → yeni kolon `kaynak_tablo` adını alır. |
| TD-39 | `nobet_kodu` → `hat_id` çözümü **zorunlu** (NÖBET kodu = hat kodu) | Kullanıcı onayı (2026-10-27): `NÖBET` kolonundaki değer, nöbet gününde uygulanan **hat kodudur** (`2`, `4`, `5`, `6`, `20`; O1 "tek rakam = hat numarası" ile tutarlı). Kod → hat eşlemesi zorunludur; sözlükte karşılığı bulunamayan kod `kural_ihlali` üretir ve plan bloke edilir (R9 sert). Kalan tek belirsizlik `×` işaretinin gün sınırı (pilot hafta elle karşılaştırması). |
| TD-40 | `gorev_grubu.referans_gun` şema satırı §3.2.10'a eklendi — F3 formülü (§6.3) bu alandan beslenir | M1a domain modeli yazılırken tespit edilen iç çelişki (2026-10-27): §6.2 ve §8.2 kolona atıf yapıyor, §3.2.10 tablosunda kolon yoktu. Yeni tasarım kararı değil; TD-27 kararının şema satırı ilk kez yazıldı. |

### 2.3 Nöbet ve vardiya ayrımı (koordinatör kararı)

| Kavram | Kaynak | Anlam | Tablo |
| --- | --- | --- | --- |
| **Nobet** | docs/01 §3 (`NÖBET` satırı), §4.1 H4, O3 (hücrede `x`) | Tip B'de `×` = aracın **nöbet günü** (41/41 varlık eşleşmesi); Tip A matrisin en sağ `NÖBET` kolonu = o günün **kodu** (33/33 kod eşleşmesi). Nöbet kaydı bu iki bilgiyi `nobet_gunu` + `nobet_kodu` olarak taşır (TD-37, TD-38); `x` işareti O3 ile `tip = NobetIsareti`. **ONAYLANDI (2026-10-27): kod = hat kodu** (TD-39); kod `hat` sözlüğüne çözülür, çözülemeyen kod planı bloke eder (docs/06 S10). | `nobet` |
| **Vardiya** (Shift) | docs/02 §2.2 `Shift.cs`, docs/01 §8 `Atama.vardiya` (`A`/`S`) | Aracın gün içindeki hizmet aralığı; sefer saatlerini gruplar. | `vardiya` |

Bağ: `nobet.vardiya_id` **nullable**. Zorunlu değil — nöbet kaydı vardiya bilgisi olmadan da geçerli (docs/01 §4'te nöbet hücresi vardiya kodu taşımıyor).

> `docs/00-glossary.md` v4 (2026-10-27) NOBET'i bu tanıma göre verir: Tip A'nın en sağ kolonu = nöbet günündeki kod, Tip B'de `×` = nöbet günü (H4).

### 2.4 Ad eşlemesi (kavram → tip)

Kod tanımlayıcıları İngilizce (`AGENTS.md` kural 3); Türkçe ad yalnızca doküman/UI'da.

| Türkçe kavram | C# tipi | Tablo | Proje (docs/02 §2.2) |
| --- | --- | --- | --- |
| Araç | `Vehicle` | `arac` | `KbPlan.Domain/Entities` |
| Hat | `Route` | `hat` | `KbPlan.Domain/Entities` |
| Sefer | `Trip` | `sefer` | `KbPlan.Domain/Entities` |
| Hafta | `Week` | `hafta` | `KbPlan.Domain/Entities` |
| Gün | `PlanningDay` | `gun` | `KbPlan.Domain/Entities` |
| Vardiya | `Shift` | `vardiya` | `KbPlan.Domain/Entities` |
| Atama | `Duty` | `atama` | `KbPlan.Domain/Entities` |
| Atama seferi | `DutyTrip` | `atama_sefer` | `KbPlan.Domain/Entities` |
| Nöbet | `Standby` | `nobet` | `KbPlan.Domain/Entities` |
| Görev grubu | `DutyGroup` | `gorev_grubu` | `KbPlan.Domain/Entities` |
| Düzeltme | `Correction` | `duzeltme` | `KbPlan.Domain/Entities` |
| Görsel kaynak | `ImageSource` | `gorsel_kaynak` | `KbPlan.Domain/Entities` |
| Üretim | `GenerationRun` | `uretim` | `KbPlan.Domain/Entities` |
| Kural ihlali | `RuleViolation` | `kural_ihlali` | `KbPlan.Domain/Entities` |

`Gun` adı `System.Threading`/`System.Linq` ile karışmadığı için `PlanningDay` seçildi (TD-26: okunabilirlik; `Day` BCL'de `DayOfWeek` ile karışıyor).

### 2.5 Kardinalite özeti

```
Hafta 1─N Gun 1─N Atama N─1 Arac
Atama N─1 Hat (nullable)      Hat 1─N Sefer
Atama N─1 Vardiya (nullable)  Atama 1─N AtamaSefer N─1 Sefer
Atama N─1 GorevGrubu (nullable)
Arac 1─N Nobet   Gun 1─N Nobet   Vardiya 1─N Nobet (nullable)
Atama 1─N Duzeltme (nullable bağ)   GorselKaynak 1─N Atama / Duzeltme / Nobet
Hafta 1─N Uretim 1─N KuralIhlali
```

---

## 3) Fiziksel şema

### 3.1 Genel kurallar

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| SQLite tip eşlemesi | `int/long`→`INTEGER`, `bool`→`INTEGER (0/1)`, `enum`→`INTEGER`, `DateOnly`→`TEXT 'yyyy-MM-dd'`, `TimeOnly`→`TEXT 'HH:mm:ss'`, `DateTime`→`TEXT 'yyyy-MM-ddTHH:mm:ss'` (UTC), `string`→`TEXT` | TD-16, TD-18; docs/02 §5.2 |
| Tarih/saat biçimi | ISO 8601, sıfır dolgulu; UTC saklanır, `tr-TR` yalnızca gösterimde | Sözlüksel sıralama = kronolojik sıralama; docs/02 §3.4 |
| Enum saklama | `INTEGER` + `CHECK (kolon IN (...))` | TD-16 |
| Kimlikler | `INTEGER PRIMARY KEY AUTOINCREMENT` | docs/02 §5.2 (GUID gerekmez) |
| Yabancı anahtar | `FOREIGN KEY ... ON DELETE RESTRICT ON UPDATE CASCADE`; `atama_sefer`, `kural_ihlali` → `CASCADE` | TD-21 |
| `PRAGMA foreign_keys` | Her bağlantıda `ON` (açıkça set + test) | SQLite varsayılanı sürüm/istemciye göre değişir; sessiz veri bozulmasını engeller |
| Metin karşılaştırma | `COLLATE NOCASE` yalnızca `arac.plaka`, `hat.hat_kodu`, `gorev_grubu.ad` | El yazısı kaynaklı büyük/küçük harf farkı (`7A`/`7a`) |
| Silme | `silindi_mi INTEGER NOT NULL DEFAULT 0` + sorgu filtresi | docs/02 §5.2, P6 |
| Zaman damgası | `olusturma_zamani`, `guncelleme_zamani` tüm ana tablolarda | TD-19 iyimser eşzamanlılık + denetim |
| Boş metin | `''` yasak; "yok" = `NULL` | Karışık `''`/`NULL` sorguları bozar |
| Adlandırma | Tablo/kolon `snake_case` (Türkçe, ASCII'ye indirgenmiş); C# tarafı `PascalCase` | Okunabilir SQL + `docs/01` adlarına yakınlık |

### 3.2 Tablolar

#### 3.2.1 `arac` (Vehicle) — 45 satır seed (docs/01 §5)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `arac_id` | INTEGER | ✗ | autoincrement | PK |
| `plaka` | TEXT(3) | ✗ | — | UNIQUE; `CHECK (length(plaka) = 3)`; `COLLATE NOCASE`; docs/01 §5 |
| `plaka_tam` | TEXT(20) | ✓ | NULL | Tam tescil (`43 ABC 123`) — varsayım, kaynakta yok |
| `arac_tipi` | INTEGER | ✗ | 0 | `CHECK IN (0,1,2)` → 0=Bilinmiyor, 1=Solo, 2=Körüklü (docs/01 §8 hipotez) |
| `kapasite` | INTEGER | ✓ | NULL | Koltuk sayısı; docs/02 §3.2 Filo ekranı |
| `model_yili` | INTEGER | ✓ | NULL | docs/02 §3.2 "yaş" alanının karşılığı |
| `klima_var` | INTEGER | ✗ | 0 | `CHECK IN (0,1)`; R12 |
| `engelli_erisim` | INTEGER | ✗ | 0 | `CHECK IN (0,1)`; R12 |
| `durum` | INTEGER | ✗ | 1 | `CHECK IN (0,1,2,3)` → 0=HizmetDisi, 1=Aktif, 2=Bakim, 3=Yedek |
| `kaynak` | TEXT | ✗ | `'basili'` | `kaynak TEXT NOT NULL DEFAULT 'basili' CHECK (kaynak IN ('basili','elle'))` → 41 basılı (`'basili'`) + elle yazılan `134, 186, 225, 229` (`'elle'`); docs/01 §5, O5 onayı 2026-10-27 (TD-36) |
| `silindi_mi` | INTEGER | ✗ | 0 | `CHECK IN (0,1)` |
| `olusturma_zamani` | TEXT | ✗ | `strftime('%Y-%m-%dT%H:%M:%S','now')` | UTC |
| `guncelleme_zamani` | TEXT | ✗ | aynı | TD-19 |

İndeksler: `ux_arac_plaka` UNIQUE(`plaka`) WHERE `silindi_mi = 0`; `ix_arac_durum`(`durum`).
İlişkiler: `atama` 1‑N, `nobet` 1‑N.

#### 3.2.2 `hat` (Route)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `hat_id` | INTEGER | ✗ | autoincrement | PK |
| `hat_kodu` | TEXT(8) | ✗ | — | UNIQUE; `COLLATE NOCASE`; `CHECK (length(hat_kodu) BETWEEN 1 AND 8)`; docs/01 §3 |
| `hat_no` | INTEGER | ✓ | NULL | Sayısal kısım (`7A` → 7); `CHECK (hat_no IS NULL OR hat_no > 0)`; O1 sonrası tek rakamlı hatlar (`2`,`5`,`6`,`7` …) da bu tabloya girebilir (`hat_kodu` = numara, `varyant` NULL) |
| `varyant` | TEXT(2) | ✓ | NULL | `CHECK (varyant IS NULL OR varyant IN ('A','B','E','T','S'))`; docs/01 §3 |
| `ad` | TEXT(60) | ✓ | NULL | Güzergâh adı — docs/01 §8 hipotez (Toki, Kampüs) |
| `sefer_suresi_dk` | INTEGER | ✓ | NULL | `CHECK (sefer_suresi_dk IS NULL OR sefer_suresi_dk > 0)`; docs/02 §3.2 |
| `mesafe_m` | INTEGER | ✓ | NULL | docs/02 §3.2 |
| `klima_gerekli` | INTEGER | ✗ | 0 | R12 |
| `engelli_gerekli` | INTEGER | ✗ | 0 | R12 |
| `aktif` | INTEGER | ✗ | 1 | `CHECK IN (0,1)` |
| `silindi_mi` | INTEGER | ✗ | 0 | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

İndeksler: `ux_hat_kodu` UNIQUE(`hat_kodu`); `ix_hat_no`(`hat_no`).
İlişkiler: `sefer` 1‑N, `atama` 1‑N (nullable FK).

#### 3.2.3 `sefer` (Trip)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `sefer_id` | INTEGER | ✗ | autoincrement | PK |
| `hat_id` | INTEGER | ✗ | — | FK → `hat` RESTRICT |
| `gun_tipi` | INTEGER | ✗ | — | `CHECK IN (1,2,3)` → 1=HaftaIci, 2=Cumartesi, 3=Pazar; docs/01 §8 |
| `yon` | INTEGER | ✗ | 1 | `CHECK IN (1,2)` → 1=Gidiş, 2=Dönüş (docs/01 §8 hipotez) |
| `baslangic_saat` | TEXT(8) | ✗ | — | `CHECK (baslangic_saat GLOB '[0-2][0-9]:[0-5][0-9]:00')`; `TimeOnly` |
| `bitis_saat` | TEXT(8) | ✓ | NULL | Aynı GLOB; boşsa `sure_dk`'dan türetilir |
| `sure_dk` | INTEGER | ✓ | NULL | `CHECK (sure_dk IS NULL OR sure_dk BETWEEN 1 AND 480)` |
| `gun_kaymasi` | INTEGER | ✗ | 0 | `CHECK IN (0,1)`; bitiş ertesi güne taşıyor mu (TD-15) |
| `sira_no` | INTEGER | ✓ | NULL | Hat içi kalkış sırası |
| `aktif` | INTEGER | ✗ | 1 | — |
| `silindi_mi` | INTEGER | ✗ | 0 | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

İndeksler: `ux_sefer_hat_gun_yon_saat` UNIQUE(`hat_id`,`gun_tipi`,`yon`,`baslangic_saat`) WHERE `silindi_mi = 0`; `ix_sefer_hat_gun`(`hat_id`,`gun_tipi`).
İlişkiler: `hat` N‑1; `atama_sefer` 1‑N.

#### 3.2.4 `hafta` (Week)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `hafta_id` | INTEGER | ✗ | autoincrement | PK |
| `baslangic_tarih` | TEXT(10) | ✗ | — | UNIQUE; Pazartesi; `CHECK (strftime('%w', baslangic_tarih) = '1')` |
| `bitis_tarih` | TEXT(10) | ✗ | — | `CHECK (bitis_tarih = date(baslangic_tarih, '+6 days'))` |
| `hafta_no` | INTEGER | ✓ | NULL | ISO hafta no (bilgi amaçlı, sıralama için kullanılmaz) |
| `dongu_sirasi` | INTEGER | ✗ | — | `CHECK (dongu_sirasi BETWEEN 1 AND 7)`; docs/01 §8; §6.2 |
| `sezon` | TEXT(20) | ✓ | NULL | docs/01 §8 |
| `toplam_arac_gun` | INTEGER | ✓ | NULL | Yalnızca içe aktarılan haftada dolu (TD-14) |
| `durum` | INTEGER | ✗ | 0 | `CHECK IN (0,1,2)` → 0=Taslak, 1=Onayli, 2=Arsiv |
| `silindi_mi` | INTEGER | ✗ | 0 | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

İndeksler: `ux_hafta_baslangic` UNIQUE(`baslangic_tarih`); `ix_hafta_dongu`(`dongu_sirasi`).
İlişkiler: `gun` 1‑N (7 satır), `uretim` 1‑N, `kural_ihlali` 1‑N.

#### 3.2.5 `gun` (PlanningDay)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `gun_id` | INTEGER | ✗ | autoincrement | PK |
| `hafta_id` | INTEGER | ✗ | — | FK → `hafta` RESTRICT |
| `tarih` | TEXT(10) | ✗ | — | UNIQUE; `DateOnly` |
| `gun_sirasi` | INTEGER | ✗ | — | `CHECK (gun_sirasi BETWEEN 1 AND 7)` → 1=Pazartesi … 7=Pazar (TD-24) |
| `gun_tipi` | INTEGER | ✗ | — | `CHECK IN (1,2,3)`; `CHECK (gun_tipi = CASE WHEN gun_sirasi >= 6 THEN gun_sirasi - 4 ELSE 1 END)` — Cumartesi=2, Pazar=3 |
| `tatil_mi` | INTEGER | ✗ | 0 | docs/02 §3.2 "tatil istisnası" |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

İndeksler: `ux_gun_tarih` UNIQUE(`tarih`); `ux_gun_hafta_sira` UNIQUE(`hafta_id`,`gun_sirasi`); `ix_gun_tipi`(`gun_tipi`).
İlişkiler: `hafta` N‑1; `atama`, `nobet` 1‑N.

#### 3.2.6 `vardiya` (Shift) — referans tablo

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `vardiya_id` | INTEGER | ✗ | autoincrement | PK |
| `kod` | TEXT(2) | ✗ | — | `CHECK (kod IN ('A','S'))`; docs/01 §3 vardiya tipi |
| `gun_tipi` | INTEGER | ✗ | — | `CHECK IN (1,2,3)`; vardiya saatleri gün tipine göre değişir |
| `ad` | TEXT(40) | ✓ | NULL | Örn. "A vardiyası (gündüz)" — UI metni |
| `baslangic_saat` | TEXT(8) | ✓ | NULL | Seed'de NULL (docs/01 §9/15 belirsiz) |
| `bitis_saat` | TEXT(8) | ✓ | NULL | — |
| `gun_kaymasi` | INTEGER | ✗ | 0 | TD-15 |
| `aktif` | INTEGER | ✗ | 1 | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

Kısıt: `CHECK ((baslangic_saat IS NULL) = (bitis_saat IS NULL))` — yarım tanım yasak.
İndeksler: `ux_vardiya_kod_gun` UNIQUE(`kod`,`gun_tipi`).
İlişkiler: `atama` 1‑N (nullable), `nobet` 1‑N (nullable).

#### 3.2.7 `atama` (Duty) — planın çekirdeği

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `atama_id` | INTEGER | ✗ | autoincrement | PK |
| `hafta_id` | INTEGER | ✗ | — | FK → `hafta` RESTRICT (TD-05) |
| `gun_id` | INTEGER | ✗ | — | FK → `gun` RESTRICT |
| `arac_id` | INTEGER | ✗ | — | FK → `arac` RESTRICT |
| `durum` | INTEGER | ✗ | 0 | `CHECK IN (0,1,2,3,4,5)` → 0=Gorevli, 1=Yat, 2=Iptal, 3=Izinli, 4=Arizali, 5=Bakim (TD-03, TD-04); `Iptal` yalnızca elle işaretlenir (`elle_duzeltme = 1`, TD-33) |
| `hat_id` | INTEGER | ✓ | NULL | FK → `hat` RESTRICT |
| `hat_no` | INTEGER | ✓ | NULL | Hücreden gelen hat numarası (tek rakam `2`,`5`,`6`,`7` …); `CHECK (hat_no IS NULL OR hat_no BETWEEN 1 AND 999)`; sözlükte karşılığı varsa `hat_id` de dolar (TD-30) |
| `vardiya_id` | INTEGER | ✓ | NULL | FK → `vardiya` RESTRICT (TD-09) |
| `gorev_grubu_id` | INTEGER | ✓ | NULL | FK → `gorev_grubu` RESTRICT |
| `sefer_sayisi` | INTEGER | ✓ | NULL | `CHECK (sefer_sayisi IS NULL OR sefer_sayisi >= 0)`; **hücreden türetilmez**: yalnızca manuel giriş veya `atama_sefer` sayımı (TD-31) |
| `gorev_kodu_ham` | TEXT(12) | ✓ | NULL | Tablodaki ham hücre (`9AT`, `5x`, `-20`); TD-08 |
| `sira_no` | INTEGER | ✓ | NULL | Tip B dikey sıra (docs/01 §10) |
| `elle_duzeltme` | INTEGER | ✗ | 0 | docs/01 §8 |
| `kilitli` | INTEGER | ✗ | 0 | TD-07 / R8 |
| `kaynak_gorsel_id` | TEXT(3) | ✓ | NULL | FK → `gorsel_kaynak` SET NULL (TD-17) |
| `uretim_id` | INTEGER | ✓ | NULL | FK → `uretim` SET NULL (elle eklenen satırda NULL) |
| `not_metni` | TEXT(120) | ✓ | NULL | docs/01 §7 yer/kişi notları (`otogar`, `Demirci`) |
| `varsayim_mi` | INTEGER | ✗ | 0 | §9.2 işareti |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | TD-19 |

Kısıtlar:
- `UNIQUE (hafta_id, gun_id, arac_id)` → **R1**.
- `CHECK ((durum <> 1) OR (hat_id IS NULL AND hat_no IS NULL AND vardiya_id IS NULL AND sefer_sayisi IS NULL))` → **R4** (YAT tutarlılığı).
- `CHECK (durum IN (3,4,5) OR durum = 1 OR hat_id IS NOT NULL OR hat_no IS NOT NULL)` → görevli satırda hat zorunlu (`hat_no` O1 sonrası yeterli, TD-30).

İndeksler: `ix_atama_gun`(`gun_id`,`durum`); `ix_atama_arac`(`arac_id`); `ix_atama_hat_no`(`hat_no`); `ix_atama_grup`(`gorev_grubu_id`); `ix_atama_uretim`(`uretim_id`).
İlişkiler: `hafta`/`gun`/`arac`/`hat`/`vardiya`/`gorev_grubu` N‑1; `atama_sefer`, `duzeltme` 1‑N.

#### 3.2.8 `atama_sefer` (DutyTrip)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `atama_sefer_id` | INTEGER | ✗ | autoincrement | PK |
| `atama_id` | INTEGER | ✗ | — | FK → `atama` **CASCADE** |
| `gun_id` | INTEGER | ✗ | — | FK → `gun` RESTRICT; R2 için denormalize |
| `sefer_id` | INTEGER | ✗ | — | FK → `sefer` RESTRICT |
| `sira_no` | INTEGER | ✗ | — | `CHECK (sira_no >= 1)` |
| `elle_duzeltme` | INTEGER | ✗ | 0 | — |

Kısıtlar: `UNIQUE (atama_id, sefer_id)`; `UNIQUE (atama_id, sira_no)`; `UNIQUE (gun_id, sefer_id)` → **R2**.
İndeksler: `ix_atama_sefer_sefer`(`sefer_id`).

> O1 (2026-10-27): `atama.sefer_sayisi` bu tablonun satır sayımından **hesaplanır**; hücredeki tek rakamdan türetilmez (TD-31). Tek gerçek kaynak bu tablodur.

#### 3.2.9 `nobet` (Standby)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `nobet_id` | INTEGER | ✗ | autoincrement | PK |
| `hafta_id` | INTEGER | ✗ | — | FK → `hafta` RESTRICT (TD-09) |
| `nobet_gunu` | INTEGER | ✓ | NULL | FK → `gun` RESTRICT; **nöbet günü**. `kaynak_tablo = 'rotasyon'` satırında zorunlu (Tip B `×`), `'matris'` satırında NULL (Tip A'da gün bilgisi yok) (TD-38) |
| `arac_id` | INTEGER | ✓ | NULL | FK → `arac` RESTRICT; NULL = araç atanmamış nöbet |
| `vardiya_id` | INTEGER | ✓ | NULL | FK → `vardiya` SET NULL; **zorunlu değil** (TD-09) |
| `tip` | INTEGER | ✗ | 0 | `CHECK IN (0,1,2,3)` → 0=Belirsiz, 1=Gece, 2=Gunduz, 3=NobetIsareti (O3: hücredeki `x`) |
| `kaynak` | INTEGER | ✗ | 0 | `CHECK IN (0,1)` → 0=Hucre, 1=Manuel; işaretin hücreden mi elle mi geldiği (TD-32) |
| `kaynak_tablo` | TEXT(8) | ✗ | `'rotasyon'` | `CHECK (kaynak_tablo IN ('matris','rotasyon'))`; bilginin geldiği tablo tipi: `rotasyon` = Tip B `×` (gün), `matris` = Tip A `NÖBET` kolonu (kod) (TD-38) |
| `nobet_kodu` | TEXT(10) | ✓ | NULL | `CHECK (nobet_kodu IS NULL OR length(nobet_kodu) BETWEEN 1 AND 10)`; **nöbet günündeki hat kodu**; `hat_id` FK'sine çözülür (kod → hat eşlemesi zorunlu, çözülemeyen kod `kural_ihlali` üretir). **`nobet_kodu` yalnızca `kaynak_tablo = 'matris'` olan satırlarda dolar** (NÖBET kolonundan); `kaynak_tablo = 'rotasyon'` (Tip B, `×` işareti) satırlarında `nobet_kodu` NULL'dur ve bu satırlarda `tip = NobetIsareti` kullanılır — CHECK bu ayrıma göre yazılır, bkz. aşağıdaki Kısıt satırı ve §5.1 (TD-37, TD-38, TD-39; M1a iç tutarlılık bulgusu 2026-10-27) |
| `kaynak_gorsel_id` | TEXT(3) | ✓ | NULL | FK → `gorsel_kaynak` SET NULL |
| `varsayim_mi` | INTEGER | ✗ | 1 | İçe aktarımda `tip` ve `kaynak_tablo` varsayımla dolduruldu → 1 |
| `not_metni` | TEXT(120) | ✓ | NULL | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

Kısıt: `UNIQUE (hafta_id, nobet_gunu, arac_id)` (kısmi: `WHERE arac_id IS NOT NULL AND nobet_gunu IS NOT NULL`); `UNIQUE (hafta_id, arac_id)` (kısmi: `WHERE kaynak_tablo = 'matris'`); `CHECK ((kaynak_tablo = 'matris' AND nobet_kodu IS NOT NULL) OR (kaynak_tablo = 'rotasyon' AND nobet_gunu IS NOT NULL AND nobet_kodu IS NULL))` — `nobet_kodu` yalnızca `kaynak_tablo = 'matris'` satırlarında (NÖBET kolonu) dolar; `kaynak_tablo = 'rotasyon'` (Tip B, `×` işareti) satırlarında `nobet_kodu` NULL'dur ve `tip = NobetIsareti` kullanılır; CHECK bu ayrıma göre yazılır (TD-32, TD-38; M1a iç tutarlılık bulgusu 2026-10-27). Eski `CHECK (tip <> 3 OR nobet_kodu IS NULL)` bu tek CHECK içinde eridi: `tip = NobetIsareti` satırı zaten `rotasyon`'dur.
İndeksler: `ix_nobet_arac`(`arac_id`); `ix_nobet_gunu`(`nobet_gunu`); `ix_nobet_tip_kaynak`(`tip`,`kaynak`); `ix_nobet_hafta_arac`(`hafta_id`,`arac_id`).

#### 3.2.10 `gorev_grubu` (DutyGroup) — referans tablo

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `grup_id` | INTEGER | ✗ | autoincrement | PK |
| `ad` | TEXT(40) | ✗ | — | UNIQUE; `COLLATE NOCASE`; `Toki`, `F.Şelebi`, `B.Çukur`, `Kampüs/Konya` (TD-10) |
| `on_ek` | TEXT(20) | ✓ | NULL | `2. Töre` — belirsiz, varsayım (§11 S12) |
| `arac_sayisi` | INTEGER | ✗ | — | `CHECK (arac_sayisi BETWEEN 1 AND 20)`; parantez içi sayı (docs/01 §3) |
| `takma_adlar` | TEXT(200) | ✓ | NULL | Virgülle ayrık okuma varyantları (`B.Evler,S.B.Çukur,Konya,Toli`) |
| `referans_gun` | INTEGER | ✓ | NULL | `CHECK (referans_gun IS NULL OR referans_gun BETWEEN 1 AND 7)`; rotasyon F3 formülünde görev grubunun başlangıç günü `g0` (§6.3, §6.2); NULL ise grup rotasyona girmez (TD-27, TD-40) |
| `sorumlu` | TEXT(60) | ✓ | NULL | docs/01 §8 hipotez |
| `aktif` | INTEGER | ✗ | 1 | — |
| `olusturma_zamani` / `guncelleme_zamani` | TEXT | ✗ | now | — |

İndeksler: `ux_gorev_grubu_ad` UNIQUE(`ad`).
İlişkiler: `atama` 1‑N.

#### 3.2.11 `duzeltme` (Correction) — denetim izi

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `duzeltme_id` | INTEGER | ✗ | autoincrement | PK |
| `atama_id` | INTEGER | ✓ | NULL | FK → `atama` RESTRICT (TD-21) |
| `nobet_id` | INTEGER | ✓ | NULL | FK → `nobet` RESTRICT |
| `tur` | INTEGER | ✗ | — | `CHECK IN (0..6)` → 0=UstuCizme, 1=Daire, 2=Ok, 3=Not, 4=Fosforlu, 5=Tarama, 6=KolonBasligi; docs/01 §7 |
| `eski_deger` | TEXT(40) | ✓ | NULL | — |
| `yeni_deger` | TEXT(40) | ✓ | NULL | — |
| `kaynak` | INTEGER | ✗ | 0 | `CHECK IN (0,1)` → 0=Gorsel, 1=Kullanici (TD-12) |
| `gorsel_kaynak_id` | TEXT(3) | ✓ | NULL | FK → `gorsel_kaynak` SET NULL |
| `aciklama` | TEXT(200) | ✓ | NULL | — |
| `zaman` | TEXT | ✗ | now | docs/01 §8 `tarih` alanı |

Kısıt: `CHECK (atama_id IS NOT NULL OR nobet_id IS NOT NULL)`.
İndeksler: `ix_duzeltme_atama`(`atama_id`); `ix_duzeltme_tur`(`tur`,`kaynak`).

#### 3.2.12 `gorsel_kaynak` (ImageSource)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `gorsel_id` | TEXT(3) | ✗ | — | PK (`G01`…`G21`); docs/01 §1 |
| `dosya_adi` | TEXT(120) | ✗ | — | UNIQUE |
| `tablo_tipi` | TEXT(1) | ✗ | — | `CHECK (tablo_tipi IN ('A','B'))`; docs/01 §2. `tablo_tipi` veritabanında `'A'` (Matris) / `'B'` (Rotasyon) harfi olarak saklanır; C# tarafında `SheetLayout` enum'una eşlenir (A=Matris, B=Rotasyon). Dönüşüm Infrastructure'daki EF converter'da yapılır (§4.3). |
| `hafta_id` | INTEGER | ✓ | NULL | FK → `hafta` SET NULL; başlıksız 2 matris için NULL + varsayım (docs/01 §9/19) |
| `okunabilirlik` | INTEGER | ✗ | — | `CHECK (okunabilirlik IN (1,2,3))` → 1=Zayıf, 2=Orta, 3=İyi |
| `mukerrer_mi` | INTEGER | ✗ | 0 | docs/01 §1.1 |
| `mukerrer_kaynak_id` | TEXT(3) | ✓ | NULL | FK → `gorsel_kaynak` SET NULL (öz-ilişki) |
| `not_metni` | TEXT(200) | ✓ | NULL | — |

İndeksler: `ix_gorsel_hafta`(`hafta_id`,`tablo_tipi`).

#### 3.2.13 `uretim` (GenerationRun)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `uretim_id` | INTEGER | ✗ | autoincrement | PK |
| `hafta_id` | INTEGER | ✗ | — | FK → `hafta` RESTRICT |
| `seed` | INTEGER | ✗ | — | Determinizm anahtarı (§7.5) |
| `motor_surumu` | TEXT(20) | ✗ | — | SemVer; algoritma değişince eski plan açıklanabilsin |
| `parametre_json` | TEXT | ✗ | — | Kural ağırlıkları + hedefler (§7.3) |
| `baslangic_zamani` | TEXT | ✗ | — | UTC |
| `bitis_zamani` | TEXT | ✓ | NULL | — |
| `sure_ms` | INTEGER | ✓ | NULL | Performans hedefi kanıtı (§7.6) |
| `durum` | INTEGER | ✗ | 0 | `CHECK IN (0,1,2,3)` → 0=Calisiyor, 1=Basarili, 2=Basarisiz, 3=Bloke |

İndeksler: `ix_uretim_hafta`(`hafta_id`,`baslangic_zamani` DESC).

#### 3.2.14 `kural_ihlali` (RuleViolation)

| Kolon | Tip | Null | Varsayılan | Kısıt / Not |
| --- | --- | --- | --- | --- |
| `ihlal_id` | INTEGER | ✗ | autoincrement | PK |
| `uretim_id` | INTEGER | ✓ | NULL | FK → `uretim` **CASCADE**; NULL = içe aktarma/elle doğrulama |
| `hafta_id` | INTEGER | ✓ | NULL | FK → `hafta` RESTRICT |
| `gun_id` | INTEGER | ✓ | NULL | FK → `gun` RESTRICT |
| `arac_id` | INTEGER | ✓ | NULL | FK → `arac` RESTRICT |
| `atama_id` | INTEGER | ✓ | NULL | FK → `atama` RESTRICT |
| `kural_kodu` | TEXT(8) | ✗ | — | `R1`…`R16` veya `I-xx` (TD-25) |
| `siddet` | INTEGER | ✗ | — | `CHECK IN (0,1,2)` → 0=Bloke, 1=Uyari, 2=Bilgi |
| `mesaj` | TEXT(300) | ✗ | — | Türkçe, kullanıcıya gösterilir |
| `olusturma_zamani` | TEXT | ✗ | now | — |

İndeksler: `ix_ihlal_uretim`(`uretim_id`,`siddet`); `ix_ihlal_hafta`(`hafta_id`,`kural_kodu`).

### 3.3 İlişki kardinalitesi (özet tablo)

| Üst | Alt | Kardinalite | FK | ON DELETE |
| --- | --- | --- | --- | --- |
| `hafta` | `gun` | 1‑N (tam 7) | `gun.hafta_id` | RESTRICT |
| `hafta` | `atama` | 1‑N | `atama.hafta_id` | RESTRICT |
| `gun` | `atama` | 1‑N | `atama.gun_id` | RESTRICT |
| `arac` | `atama` | 1‑N | `atama.arac_id` | RESTRICT |
| `hat` | `atama` | 1‑N (nullable) | `atama.hat_id` | RESTRICT |
| `vardiya` | `atama` | 1‑N (nullable) | `atama.vardiya_id` | RESTRICT |
| `gorev_grubu` | `atama` | 1‑N (nullable) | `atama.gorev_grubu_id` | RESTRICT |
| `hat` | `sefer` | 1‑N | `sefer.hat_id` | RESTRICT |
| `atama` | `atama_sefer` | 1‑N | `atama_sefer.atama_id` | CASCADE |
| `sefer` | `atama_sefer` | 1‑N | `atama_sefer.sefer_id` | RESTRICT |
| `gun` | `nobet` | 1‑N | `nobet.nobet_gunu` (nullable) | RESTRICT |
| `arac` | `nobet` | 1‑N (nullable) | `nobet.arac_id` | RESTRICT |
| `vardiya` | `nobet` | 1‑N (nullable) | `nobet.vardiya_id` | SET NULL |
| `atama` | `duzeltme` | 1‑N (nullable) | `duzeltme.atama_id` | RESTRICT |
| `gorsel_kaynak` | `atama` / `nobet` / `duzeltme` | 1‑N | `*.kaynak_gorsel_id` | SET NULL |
| `hafta` | `uretim` | 1‑N | `uretim.hafta_id` | RESTRICT |
| `uretim` | `kural_ihlali` | 1‑N (nullable) | `kural_ihlali.uretim_id` | CASCADE |

### 3.4 Unique kısıt özeti

| # | Kısıt | Kural | Neden |
| --- | --- | --- | --- |
| 1 | `arac.plaka` | — | Plaka birincil iş kimliği (docs/01 §8) |
| 2 | `hat.hat_kodu` | — | Kod tekrarı planı bozar |
| 3 | `hafta.baslangic_tarih` | — | Aynı hafta iki kez açılamaz |
| 4 | `gun.tarih`, `gun(hafta_id, gun_sirasi)` | — | 7 gün, tek takvim |
| 5 | `atama(hafta_id, gun_id, arac_id)` | R1 | Aynı araç aynı gün tek atama |
| 6 | `atama_sefer(gun_id, sefer_id)` | R2 | Aynı sefer aynı gün tek araç |
| 7 | `atama_sefer(atama_id, sira_no)` | — | Sıra tekrarı yok |
| 8 | `vardiya(kod, gun_tipi)` | — | Vardiya tanımı tekil |
| 9 | `gorev_grubu.ad` | — | Grup tekil |
| 10 | `sefer(hat_id, gun_tipi, yon, baslangic_saat)` | — | Sefer tanımı tekil |
| 11 | `nobet(hafta_id, nobet_gunu, arac_id)` | R9 | Nöbet satırı tekil (gün bilinen rotasyon satırı); matris satırı için `nobet(hafta_id, arac_id)` |

### 3.5 Seed (referans veri)

| Tablo | Satır | Kaynak | Not |
| --- | --- | --- | --- |
| `arac` | 45 | docs/01 §5 | 41 basılı (`kaynak='basili'`) + 4 elle (`134, 186, 225, 229`, `kaynak='elle'`). docs/05 M1 "41 plakalık" diyor; fark §12'de not edildi (TD-36). |
| `hat` | ~12 | docs/01 §3 | Yalnızca hat olduğu doğrulanan kodlar: `7A, 8A, 9A, 9AT, 10A, 12A, 26A, 26B, 26E, 27A, 27B, 27E` (belirsiz olanlar seed'e girmez, §9.2). O1 (2026-10-27) sonrası tek rakam kodlar hat numarasıdır; sözlüğe eklenmeleri kullanıcı hat listesine bağlıdır, eklenmeyenler `atama.hat_no`'da kalır (TD-30). |
| `vardiya` | 6 | docs/02 §2.2, docs/01 §3 | `A`/`S` × 3 gün tipi; saatler NULL (varsayım) |
| `gorev_grubu` | 4 | docs/01 §6.1 | `Toki`(6), `F.Şelebi`(2), `B.Çukur`(5), `Kampüs/Konya`(1) |
| `gorsel_kaynak` | 21 | docs/01 §1 | Mükerrer 5 kayıt `mukerrer_mi=1` |
| `sefer` | 0 | — | M2 içe aktarımı veya kullanıcı girişi doldurur |

> **O5 seed kuralı (2026-10-27):** Seed = 45 plaka (docs/01 §5); elle eklenenler `kaynak='elle'` ile işaretlenir; pilot hafta karşılaştırması 44/45 belirsizliğini kapatır.

> Seed `HasData` ile migration'a gömülmez; `seed/` altındaki idempotent SQL betiği uygulama açılışında çalışır (TD-20).

---

## 4) EF Core eşlemesi

### 4.1 `PlanDbContext`

| DbSet | Entity | Tablo |
| --- | --- | --- |
| `Vehicles` | `Vehicle` | `arac` |
| `Routes` | `Route` | `hat` |
| `Trips` | `Trip` | `sefer` |
| `Weeks` | `Week` | `hafta` |
| `Days` | `PlanningDay` | `gun` |
| `Shifts` | `Shift` | `vardiya` |
| `Duties` | `Duty` | `atama` |
| `DutyTrips` | `DutyTrip` | `atama_sefer` |
| `Standbys` | `Standby` | `nobet` |
| `DutyGroups` | `DutyGroup` | `gorev_grubu` |
| `Corrections` | `Correction` | `duzeltme` |
| `ImageSources` | `ImageSource` | `gorsel_kaynak` |
| `GenerationRuns` | `GenerationRun` | `uretim` |
| `RuleViolations` | `RuleViolation` | `kural_ihlali` |

```csharp
// KbPlan.Infrastructure/Persistence/PlanDbContext.cs
public sealed class PlanDbContext(DbContextOptions<PlanDbContext> options) : DbContext(options)
{
    public DbSet<Duty> Duties => Set<Duty>();
    // ... diğer DbSet'ler

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.ApplyConfigurationsFromAssembly(typeof(PlanDbContext).Assembly);
        b.UseCollation("NOCASE");           // yalnızca plaka/kod alanlarında etkili (bkz. §3.1)
    }
}
```

Bağlantı kurulumu (Infrastructure, `SqliteConnectionFactory`):

```csharp
// her açılan bağlantıda
PRAGMA journal_mode=WAL;      // docs/02 §5.2
PRAGMA foreign_keys=ON;       // §3.1
PRAGMA busy_timeout=5000;
```

### 4.2 Entity konfigürasyonları (`IEntityTypeConfiguration`)

| Dosya | Sorumluluk | Kritik satır |
| --- | --- | --- |
| `VehicleConfiguration` | tablo/kolon adları, `plaka` unique + length 3, `durum`/`kaynak` CHECK | `HasIndex(v => v.Plate).IsUnique().HasFilter("silindi_mi = 0")` |
| `RouteConfiguration` | `hat_kodu` unique, `varyant` CHECK | `Property(r => r.Code).HasMaxLength(8).UseCollation("NOCASE")` |
| `TripConfiguration` | `TimeOnly` dönüştürücü, bileşik unique, `gun_kaymasi` | `HasIndex(t => new { t.RouteId, t.DayType, t.Direction, t.StartTime }).IsUnique()` |
| `WeekConfiguration` | `DateOnly` dönüştürücü, `dongu_sirasi` CHECK 1–7 | `ToTable("hafta")` |
| `DayConfiguration` | iki unique indeks, `gun_tipi` türetme CHECK | `HasIndex(d => new { d.WeekId, d.DayOrder }).IsUnique()` |
| `ShiftConfiguration` | `(kod, gun_tipi)` unique | — |
| `DutyConfiguration` | `UNIQUE(hafta,gun,arac)`, `durum` CHECK, YAT CHECK, `hat_no` CHECK, FK'ler | `HasIndex(d => new { d.WeekId, d.DayId, d.VehicleId }).IsUnique()` |
| `DutyTripConfiguration` | `(gun_id, sefer_id)` unique, `atama` CASCADE | `HasOne(x => x.Duty).WithMany(d => d.Trips).OnDelete(DeleteBehavior.Cascade)` |
| `StandbyConfiguration` | iki kısmi unique (gün bilinen rotasyon satırı + matris satırı), `kaynak_tablo` CHECK, `vardiya` SET NULL | `HasIndex(s => new { s.WeekId, s.NobetGunu, s.VehicleId }).IsUnique().HasFilter("arac_id IS NOT NULL AND nobet_gunu IS NOT NULL")` + `HasIndex(s => new { s.WeekId, s.VehicleId }).IsUnique().HasFilter("kaynak_tablo = 'matris'")` (TD-38) |
| `DutyGroupConfiguration` | `ad` unique NOCASE | — |
| `CorrectionConfiguration` | `tur` CHECK, `kaynak` CHECK | — |
| `ImageSourceConfiguration` | öz-ilişki SET NULL, `tablo_tipi` CHECK | `HasOne(i => i.DuplicateOf).WithMany().HasForeignKey(i => i.DuplicateOfId)` |
| `GenerationRunConfiguration` | `seed`, `motor_surumu` zorunlu | — |
| `RuleViolationConfiguration` | `uretim` CASCADE, `siddet` CHECK | — |

Örnek (kural CHECK'leri SQLite düzeyinde de zorunlu — EF doğrulaması yeterli değil):

```csharp
// KbPlan.Infrastructure/Persistence/Configurations/DutyConfiguration.cs
public void Configure(EntityTypeBuilder<Duty> b)
{
    b.ToTable("atama", t =>
    {
        t.HasCheckConstraint("ck_atama_durum", "durum IN (0,1,2,3,4,5)");
        t.HasCheckConstraint("ck_atama_yat_bos",
            "(durum <> 1) OR (hat_id IS NULL AND hat_no IS NULL AND vardiya_id IS NULL AND sefer_sayisi IS NULL)");
        t.HasCheckConstraint("ck_atama_gorevli_hat",
            "durum IN (3,4,5) OR durum = 1 OR hat_id IS NOT NULL OR hat_no IS NOT NULL");
        t.HasCheckConstraint("ck_atama_hat_no",
            "hat_no IS NULL OR hat_no BETWEEN 1 AND 999");
    });
    b.HasIndex(d => new { d.WeekId, d.DayId, d.VehicleId }).IsUnique();
}
```

### 4.3 Değer dönüştürücüleri

| Tip | Dönüştürücü | Depolama | Not |
| --- | --- | --- | --- |
| `DateOnly` | `DateOnlyToStringConverter("yyyy-MM-dd")` | TEXT | docs/02 §5.2 |
| `TimeOnly` | `TimeOnlyToStringConverter("HH:mm:ss")` | TEXT | Karşılaştırma sözlüksel çalışır (sıfır dolgu) |
| `DateTime` | `DateTimeToStringConverter("yyyy-MM-ddTHH:mm:ss")` + `DateTimeKind.Utc` | TEXT | Yerel saat saklanmaz |
| `bool` | `BoolToZeroOneConverter<int>()` | INTEGER | TD-16 |
| `enum` | `EnumToNumberConverter<T,int>()` | INTEGER | TD-16 |
| `PlateNumber` (VO) | `ValueConverter<PlateNumber,string>` | TEXT | docs/02 §2.2 `ValueObjects/PlateNumber.cs` |
| `TimeRange` (VO) | bileşik → `baslangic_saat` + `bitis_saat` + `gun_kaymasi` | TEXT/INTEGER | docs/02 §2.2 `TimeRange.cs` |
| `SheetLayout` (enum) | Enum ↔ harf dönüşümü: `SheetLayout` (A/B) — A=Matris, B=Rotasyon | TEXT(1) | `gorsel_kaynak.tablo_tipi` (§3.2.12); dönüşüm Infrastructure EF converter'ında |

### 4.4 Migration stratejisi

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| Set sayısı | **Tek migration seti** (`Persistence/Migrations`) | docs/02 §5.3; çoklu set bu ölçekte karmaşıklık |
| Üretim | `dotnet ef migrations add <Ad>` (SDK gerekir → bu makinede **çalıştırılamaz**, docs/02 R1) | — |
| Uygulama açılışı | Yedek al → `Migrate()` → `PRAGMA user_version` kontrolü | docs/02 §5.3, §5.4 |
| Seed | Migration dışında, idempotent SQL (`seed/001_reference.sql`) | TD-20 |
| Geri alma | `Down()` yalnızca geliştirmede; üretimde yedekten dönüş | docs/02 §9 |
| Test | (a) boş DB → son migration, (b) dolu örnek DB → migration, (c) seed iki kez → satır sayısı değişmez | §10 T14 |

### 4.5 Eşzamanlılık (SQLite için `RowVersion` yerine ne?)

| Katman | Mekanizma | Gerekçe |
| --- | --- | --- |
| Süreç içi | Tek yazar `SemaphoreSlim(1,1)` (Infrastructure'da singleton) | docs/02 §5.2 |
| Süreçler arası | Kilit dosyası + tek örnek kilidi | docs/02 R8 |
| İyimser denetim | `guncelleme_zamani` karşılaştırması: `UPDATE ... WHERE atama_id=@id AND guncelleme_zamani=@beklenen`; 0 satır → `ConcurrencyConflictException` | SQLite'ta `rowversion` sütunu yok (TD-19) |
| Çakışma UI'ı | "Bu satır başka bir işlemde değişti, yenileyin" + satırı yeniden yükle | Sessiz üzerine yazma yasak |
| Toplu üretim | Üretim çalışırken UI yazma kilitli (`uretim.durum = Calisiyor` bayrağı) | Kısmi plan görünmesin |

### 4.6 Performans notları

| Konu | Kural | Neden |
| --- | --- | --- |
| Okuma | Haftalık grid tek projeksiyon + `AsNoTracking()` | docs/02 §5.2; N+1 yok |
| Toplu ekleme | `ChangeTracker.AutoDetectChangesEnabled = false` + tek `SaveChanges()` (315 atama + ~1500 `atama_sefer`) | Change tracker maliyeti; tek transaction |
| Toplu güncelleme | `ExecuteUpdate` (EF Core 10) ile `durum`/`kilitli` yığın güncellemesi | 315 satır için nesne yükleme gereksiz |
| Sorgu şekli | `.Select(...)` ile anonim DTO; entity grafiği çekilmez | Grid 300 satır × 11 kolon (docs/02 §3.3) |
| İndeks | §3.2'deki indeksler; `atama(gun_id, durum)` grid sorgusunun ana erişimi | — |
| Bağlantı | Tek `SqliteConnection` (WAL), komut başına yeniden açma yok | WAL + tek kullanıcı |
| Ölçüm | Üretim testinde `uretim.sure_ms` kaydı; 1 sn eşiği testte assert | §7.6 |

---

## 5) Kural kataloğu

**Kod şeması:** `R<n>`. `Sert` = ihlal edilirse plan onaylanamaz/üretim bloke. `Yumusak` = uyarı + skor kaybı.
Her kuralın doğrulama mesajı Türkçe ve kullanıcıya gösterilir (docs/02 §3.4).

| Kod | Kural | Sert/Yumuşak | İhlalde ne olur | Baktığı alanlar | Doğrulama mesajı (TR) | Kaynak |
| --- | --- | --- | --- | --- | --- | --- |
| **R1** | Bir araç bir günde en fazla bir atama alır | **Sert** | Kayıt reddedilir (`UNIQUE`), üretim o hücreyi atlar | `atama(hafta_id, gun_id, arac_id)` | "Araç {plaka} {tarih} gününde birden fazla göreve atanmış." | docs/01 §7, §10 (çakışma kontrolü) |
| **R2** | Bir sefer bir günde tek araç tarafından yapılır | **Sert** | Üretim bloke; çakışan atama işaretlenir | `atama_sefer(gun_id, sefer_id)` | "{saat} seferi hem {plaka1} hem {plaka2} üzerinde görünüyor." | TD-06 (sefer granülerliği) |
| **R3** | Arızalı, izinli, bakımdaki veya hizmet dışı araç görev almaz | **Sert** | Atama oluşturulmaz; varsa `durum` gerekçesiyle `Arizali`/`Bakim`e çekilir (`Iptal` yalnızca elle işaretlenir, TD-33) | `arac.durum`, `atama.durum ∈ {Izinli, Arizali, Bakim}`, `gun.tarih` | "{plaka} {tarih} günü {gerekçe} nedeniyle görev alamaz." | docs/01 §7 (a), §9/11 |
| **R4** | `YAT` ataması hat/sefer/vardiya taşımaz | **Sert** | Kayıt reddedilir (CHECK) | `atama.durum`, `hat_id`, `hat_no`, `vardiya_id`, `sefer_sayisi` | "{plaka} yatan araç olarak işaretli ama görev bilgisi taşıyor." | docs/01 §8 tasarım notu; TD-30 |
| **R5** | Günlük çalışan araç sayısı hedef aralıkta olmalı (hafta içi 4–12, hafta sonu 18–24) | Yumuşak | Uyarı + skor cezası; üretim devam eder | `gun.gun_tipi`, `atama.durum = Gorevli` sayımı | "{tarih}: {sayi} araç çalışıyor, beklenen {min}–{max}." | docs/01 §4 (**hipotez**, §11 S4) |
| **R6** | Hafta sonu araç sayısı hafta içinden az olmamalı | Yumuşak | Uyarı; rapor satırı | `gun.gun_tipi` bazlı sayım | "Hafta sonu {cmt}/{paz} araç sayısı hafta içi ortalamasının altında." | docs/01 §4, §9/4, §9/18 |
| **R7** | Görev grubu–gün eşleşmesi 7 haftalık döngüye uyar (resmî kural, O4) | **Sert** | Onay bloke; üretim hücreyi rotasyon gününe taşır veya kullanıcı hücreyi kilitler | `gorev_grubu`, `gun.gun_sirasi`, `hafta.dongu_sirasi` | "{grup} bu hafta {gun} gününde olmalıydı, {gercek_gun} gününe atanmış." | docs/01 §6.1, §9/20; O4 (2026-10-27), TD-34 |
| **R8** | Kilitli (elle düzeltilmiş) atama değiştirilemez | **Sert** | Motor hücreyi atlar; değiştirme denemesi hata verir | `atama.kilitli`, `atama.elle_duzeltme` | "{plaka} {tarih} elle kilitlenmiş; otomatik üretim bu hücreye dokunamaz." | docs/01 §7, §10 |
| **R9** | Her aracın haftada **en fazla 1 nöbet günü** vardır (Tip B'de tek `×`); nöbet gününde araç `NÖBET` kolonundaki **kodu** uygular. NÖBET kodunun hat karşılığı bulunamazsa plan bloke edilir (kod → hat sözlüğü zorunlu). | **Sert** | Onay bloke; üretim ikinci nöbet gününü ve kodu olmayan nöbet kaydını reddeder; nöbet dengesi (±1) yalnızca uyarı/skor sinyali olarak raporlanır | `nobet.arac_id`, `nobet.nobet_gunu`, `nobet.nobet_kodu`, `nobet.kaynak_tablo`, geçmiş haftalar | "{plaka} {hafta} haftasında {n} nöbet günü almış, en fazla 1 olmalı." | docs/01 §4.1 H4 (41/41 varlık + 33/33 kod = %100 → Sert), §9/10; O3 (2026-10-27); TD-32, TD-37, TD-38, TD-39 |
| **R10** | Vardiya zinciri ve asgari dinlenme süresi korunur | **Sert** | Atama reddedilir / üretim bloke | `vardiya.baslangic_saat/bitis_saat`, ardışık `gun` atamaları | "{plaka} {tarih} vardiyası ile önceki vardiya arasında {dk} dk var, en az {min} dk olmalı." | docs/02 §2.1 (Domain kuralı), docs/02 R6 |
| **R11** | Gece yarısını aşan vardiya/sefer `gun_kaymasi` ile tutarlı işaretlenir | **Sert** | Kayıt reddedilir; üretimde hata | `sefer.gun_kaymasi`, `vardiya.gun_kaymasi`, `bitis_saat` | "{saat} bitişli görev ertesi güne taşıyor ancak 'gün kayması' işaretlenmemiş." | docs/02 R6, TD-15 |
| **R12** | Araç–hat uyumu: hat klimayı/engelli erişimi gerektiriyorsa araç sağlamalı | **Sert** | Aday havuzundan çıkarılır | `hat.klima_gerekli`, `hat.engelli_gerekli`, `arac.klima_var`, `arac.engelli_erisim` | "{plaka} {hat} hattı için gerekli donanıma sahip değil." | docs/02 §2.1, §3.2 |
| **R13** | Görev grubuna atanan araç sayısı grup tanımıyla uyuşur | Yumuşak | Uyarı + skor cezası | `gorev_grubu.arac_sayisi`, gün bazlı atama sayımı | "{grup} grubunda {sayi} araç var, tanımlı sayı {beklenen}." | docs/01 §3, §9/12 |
| **R14** | Aynı görev grubu bir haftada tek güne atanır | **Sert** | Üretim bloke | `atama.gorev_grubu_id`, `atama.gun_id` (hafta içinde tekil) | "{grup} bu hafta hem {gun1} hem {gun2} gününe atanmış." | docs/01 §6.1 |
| **R15** | Haftalık toplam araç-gün = günlük araç sayılarının toplamı | **Sert** (tutarlılık) | İçe aktarımda uyuşmazsa hafta "doğrulanmadı" işaretlenir | `hafta.toplam_arac_gun`, gün sayımları | "Haftalık toplam {hesap}, tabloda yazan {tablo}." | docs/01 §4 (`=76`, `=101`), §9/5 |
| **R16** | Sefer seti gün tipiyle uyumlu (Cmt/Paz tarifesi ayrı) | **Sert** | Uyuşmayan sefer atanamaz | `sefer.gun_tipi`, `gun.gun_tipi` | "{hat} {saat} seferi {gun_tipi} tarifesinde tanımlı değil." | docs/01 §2 (Tip A), §4 |
| **R17** | 7 haftalık döngüde araç başına nöbet günü sayısı dengeli dağılır (±1) | Yumuşak | Uyarı + rapor satırı; onay bloke olmaz. Geçmiş 6 hafta yoksa karşılaştırma yapılmaz | `nobet` (bu hafta + son 6 hafta), `arac` | "{plaka} son 7 haftada {sayi} nöbet günü almış; dengeli dağılımda en fazla {en_fazla} olmalı." | K3 (2026-11-01), docs/01 §4.1 (H4), TD-32 |
| **R18** | Nöbet gününün ertesi gününe aynı araca atama yazılmaz | Yumuşak | Uyarı + rapor satırı; onay bloke olmaz. Haftanın son günündeki nöbette karşılaştırma yapılmaz | `nobet.nobet_gunu`, ertesi gün `atama(gun_id, arac_id, durum)` | "{plaka} {tarih} günü nöbetçi, ertesi gün ({ertesi_tarih}) yeniden atama almış; nöbet sonrası gün boş olmalı." | K3 (2026-11-01) |

**Dağılım:** 18 kural → **13 sert** (R1, R2, R3, R4, R7, R8, R9, R10, R11, R12, R14, R15, R16), **5 yumuşak** (R5, R6, R13, R17, R18). R7 O4 (2026-10-27) ile, R9 H4 (2026-10-27, `docs/01` §4.1) ile yumuşaktan sert'e alındı. R17/R18 K3 (2026-11-01) kararıyla **yumuşak** olarak eklendi.
**docs/01 gözlemlerinden türeyen:** R1, R3, R5, R6, R7, R8, R9, R13, R14, R15 (10 kural; gereken en az 5).

### 5.1 Kural önceliği ve çelişki yönetimi

| Durum | Davranış | Gerekçe |
| --- | --- | --- |
| Sert kural ↔ yumuşak kural çatışması | Sert kural kazanır; yumuşak ihlal raporda kalır | Plan geçerliliği pazarlık dışı |
| İki sert kural aynı hücrede çatışıyor (ör. R10 vs R12) | Motor hücreyi **boş bırakır**, `kural_ihlali` `siddet=0` ile "çözülemedi" yazar, kullanıcıya sunar | docs/02 R11: çözülemeyen hücre raporu; sessizce birini feda etmek yasak |
| Yumuşak kurallar arası çelişki | Ağırlık toplamı sabit; skor fonksiyonu hangisi daha az ceza veriyorsa onu seçer | §7.3 |
| docs/01 §9'daki belirsizlikler (`9AT`, `12G`/`12P`) | `9AT` gibi ekli kodlar **kural tetiklemez**; `gorev_kodu_ham`'da saklanır, `varsayim_mi=1` | Belirsiz veri kural üretmez (P2) |
| Eksi kodlar (`-<hat>`, `-20`) ve saat biçimi (`H.MM`, `12.00`) | **Artık belirsiz değil, kural tetikler** (ONAYLANDI 2026-11-01, S14/S15): `-<hat>` eksi kodları ek görev (`-20` => 20 hattına ilave görev, hat numarası çıkarılır), `H.MM` saat biçimi (`12.00` => 12:00) sefer başlangıç saati olarak normalize edilir; ham kod `gorev_kodu_ham` alanında saklanır | S14 ve S15 onaylandı; belirsizlik kapandı |
| Tek rakam kod (O1) | **Hat numarası**: `atama.hat_no`'ya yazılır; hat sözlüğünde karşılığı yoksa `hat_id` NULL kalır, `varsayim_mi=1` | O1 (2026-10-27) ile belirsizlik kapandı (TD-30) |
| Hücredeki `x` (O3 + H4) | Nöbet işareti = **nöbet günü**: `nobet(tip = NobetIsareti, kaynak = Hucre, kaynak_tablo = 'rotasyon', nobet_gunu = gun_id)`; bu satırda `nobet_kodu` **NULL**'dur — kod, `NÖBET` kolonundan ayrı bir `kaynak_tablo = 'matris'` satırına yazılır (`nobet_kodu` yalnızca matris satırlarında dolar); `atama` üretilmez | O3 (2026-10-27) + H4 (varlık 41/41, kod 33/33) → TD-32, TD-37, TD-38; `atama.durum = Iptal` hücreden üretilmez (TD-33) |

---

## 6) Rotasyon modeli

### 6.1 Gözlem (docs/01 §6.1)

7 haftalık kanıt: görev grubu–gün eşleşmesi her hafta **bir gün geriye** kayıyor ve 7 haftada tam tur atıyor.

**O4 (kullanıcı onayı 2026-10-27):** Bu kayma **resmî kuraldır** (hipotez değil). Aşağıdaki tablo ve F3 formülü bağlayıcıdır; ihlal R7 **sert** kuralıyla onayı bloke eder (TD-34).

| Grup | 14.09 | 21.09 | 28.09 | 05.10 | 12.10 | 19.10 | 26.10 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `(6) Toki` | PER (4) | ÇAR (3) | SAL (2) | PZT (1) | PAZ (7) | CMT (6) | CUM (5) |
| `(1) Kampüs/Konya` | — | CUM (5) | PER (4) | ÇAR (3) | SAL (2) | PZT (1) | PAZ (7) |
| `(2) F.Şelebi` | — | CMT (6) | CUM (5) | PER (4) | ÇAR (3) | SAL (2) | PZT (1) |
| `(5) B.Çukur` | — | PZT (1) | PAZ (7) | CMT (6) | CUM (5) | PER (4) | ÇAR (3) |

Kaynak: docs/01 §6.1 (G17→G15→G11→G09→G06→G04→G01).

### 6.2 Veri modeli

| Öğe | Nerede | Rol |
| --- | --- | --- |
| Referans hafta `W0` | `appsettings.json` → `Rotation:AnchorWeek = "2026-09-21"` | Döngü başlangıcı (TD-23) |
| `hafta.dongu_sirasi` | `hafta` tablosu | 1–7; `W0` için 1 |
| `gun.gun_sirasi` | `gun` tablosu | 1=Pazartesi … 7=Pazar (TD-24) |
| `gorev_grubu.referans_gun` | `gorev_grubu` tablosu (**ek kolon**, TD-27) | Grubun `W0` haftasındaki gün sırası (`g0`) |
| `atama.sira_no` | `atama` tablosu | Grup içi araç sırası (Tip B dikey sıra) |

TD-27 gerekçesi: `g0` her grup için sabit bir başlangıç değeridir; hesaplanamaz, veri olarak tutulmalıdır (docs/01 §6.1 tablosundan okunur).

### 6.3 Formüller

| # | Formül | Açıklama |
| --- | --- | --- |
| F1 | `w = hafta_sirasi − W0_sirasi` | `hafta_sirasi` = `W0`'dan itibaren artan hafta sayacı (negatif olabilir) |
| F2 | `dongu_sirasi = ((w mod 7) + 7) mod 7 + 1` | 1–7 arası döngü konumu (matematiksel mod) |
| F3 | `gun_sirasi(grup, w) = ((g0(grup) − w − 1) mod 7) + 1` | Hafta `w`'de grubun düşeceği gün; `mod` = matematiksel mod |
| F4 | `gun_sirasi(grup, w) = gun_sirasi(grup, w+7)` | 7 haftalık periyot kanıtı |
| F5 | `sira_no(grup, w) = atama.sira_no(grup, w−1)` | Araç sırası önceki haftadan devralınır (varsayım, §6.5) |

`w` hesabı: `hafta_sirasi = (baslangic_tarih − W0_tarih).Days / 7`.

### 6.4 Dönüşüm tablosu (`w` → gün)

| `w` | `dongu_sirasi` | `g0=5` (Kampüs) | `g0=6` (F.Şelebi) | `g0=1` (B.Çukur) | `g0=3` (Toki) |
| --- | --- | --- | --- | --- | --- |
| −1 | 7 | 6 CMT | 7 PAZ | 2 SAL | 4 PER |
| 0 | 1 | 5 CUM | 6 CMT | 1 PZT | 3 ÇAR |
| 1 | 2 | 4 PER | 5 CUM | 7 PAZ | 2 SAL |
| 2 | 3 | 3 ÇAR | 4 PER | 6 CMT | 1 PZT |
| 3 | 4 | 2 SAL | 3 ÇAR | 5 CUM | 7 PAZ |
| 4 | 5 | 1 PZT | 2 SAL | 4 PER | 6 CMT |
| 5 | 6 | 7 PAZ | 1 PZT | 3 ÇAR | 5 CUM |
| 6 | 7 | 6 CMT | 7 PAZ | 2 SAL | 4 PER |

### 6.5 Üç örnek hafta ile doğrulama

Seçilen haftalar: `w=0` (21.09.2026), `w=2` (05.10.2026), `w=5` (26.10.2026). Karşılaştırma kaynağı: docs/01 §6.1.

| Hafta | `w` | Grup | `g0` | F3 sonucu | docs/01 §6.1 | Sonuç |
| --- | --- | --- | --- | --- | --- | --- |
| 21.09–27.09 | 0 | Kampüs/Konya | 5 | `((5−0−1) mod 7)+1 = 5` → CUMA | CUMA | ✅ |
| 21.09–27.09 | 0 | F.Şelebi | 6 | 6 → CUMARTESİ | CUMARTESİ | ✅ |
| 21.09–27.09 | 0 | B.Çukur | 1 | 1 → PAZARTESİ | PAZARTESİ | ✅ |
| 21.09–27.09 | 0 | Toki | 3 | 3 → ÇARŞAMBA | ÇARŞAMBA | ✅ |
| 05.10–11.10 | 2 | Kampüs/Konya | 5 | `((5−2−1) mod 7)+1 = 3` → ÇARŞAMBA | ÇARŞAMBA | ✅ |
| 05.10–11.10 | 2 | F.Şelebi | 6 | 4 → PERŞEMBE | PERŞEMBE | ✅ |
| 05.10–11.10 | 2 | B.Çukur | 1 | `((1−3) mod 7)+1 = 6` → CUMARTESİ | CUMARTESİ | ✅ |
| 05.10–11.10 | 2 | Toki | 3 | 1 → PAZARTESİ | PAZARTESİ | ✅ |
| 26.10–01.11 | 5 | Kampüs/Konya | 5 | `((5−5−1) mod 7)+1 = 7` → PAZAR | PAZAR | ✅ |
| 26.10–01.11 | 5 | F.Şelebi | 6 | 1 → PAZARTESİ | PAZARTESİ | ✅ |
| 26.10–01.11 | 5 | B.Çukur | 1 | `((−5) mod 7)+1 = 3` → ÇARŞAMBA | ÇARŞAMBA | ✅ |
| 26.10–01.11 | 5 | Toki | 3 | `((3−6) mod 7)+1 = 5` → CUMA | CUMA | ✅ |

**Sonuç: 12/12 hücre docs/01 §6.1 ile uyuşuyor.** Negatif `w` testi: `w=−1` (14.09) → Toki `g0=3` → `((3+1−1) mod 7)+1 = 4` = PERŞEMBE; docs/01 §6.1 birinci tabloda 14.09 = PERŞEMBE ✅.

**Sınır durumu:** `w=6` ile `w=−1` aynı günü vermeli (F4): `g0=5` için `w=6` → `((5−7) mod 7)+1 = 6` CMT; `w=−1` → `((5+1−1) mod 7)+1 = 6` CMT ✅.

### 6.6 Araç sırası (`sira_no`) — belirsiz

docs/01 §6.2: plaka listeleri haftalar arası sıra değiştiriyor ama çekirdek plakalar aynı. Birebir eşleme **doğrulanmadı** (docs/01 §9/9).

| Karar | Değer | Etiket |
| --- | --- | --- |
| `sira_no` kaynağı | Önceki haftanın aynı grup–gün listesi (F5) | varsayım |
| Araç yoksa | Liste kapatılır (sonraki araçlar bir sıra öne kayar), yeni araç sona eklenir | varsayım |
| `sira_no` kural mı? | Hayır; yalnızca yumuşak tercih (skor bileşeni), R kuralı değil | tasarım kararı |
| Doğrulama | O2 (2026-10-27): `sira_no` **Tip B**'den okunur, Tip A yalnızca çapraz doğrulama | O2 (TD-35) |

---

## 7) Üretim algoritması

### 7.1 Girdi

| # | Girdi | Kaynak | Zorunlu |
| --- | --- | --- | --- |
| 1 | Filo (45 araç + `durum`) | `arac` | ✓ |
| 2 | Hat listesi + donanım gereksinimleri | `hat` | ✓ |
| 3 | Sefer ihtiyacı (hat × gün tipi × saat) | `sefer` | ✓ |
| 4 | Hedef hafta (7 `gun` satırı) | `hafta`, `gun` | ✓ |
| 5 | Önceki haftanın planı (varsa) | `atama` (önceki `hafta_id`) | ✗ (yoksa sıra varsayılan) |
| 6 | İzin/arıza/bakım bildirimleri | `atama.durum ∈ {Izinli, Arizali, Bakim}` + `arac.durum` | ✗ |
| 7 | Kilitli (elle düzeltilmiş) atamalar | `atama.kilitli = 1` | ✗ |
| 8 | Kural ağırlıkları + hedefler | `appsettings.json` → `Planning:*` | ✓ (varsayılan var) |
| 9 | `seed` | Kullanıcı veya `uretim` kaydı | ✓ |

### 7.2 Adım akışı

| Adım | İş | Çıktı | Hata durumu |
| --- | --- | --- | --- |
| A1 | Girdi doğrulama (referans bütünlüğü, hafta 7 gün, filo boş değil) | `InputValidationResult` | Bloke: `uretim.durum = Basarisiz` |
| A2 | Kilitli atamaları sabitle | Dokunulmaz hücre kümesi | — |
| A3 | Rotasyon çekirdeği: her grup için hedef gün (F3) | `(grup, gun_sirasi)` çiftleri | Grup `g0` yoksa uyarı + atla |
| A4 | Günlük talep: gün tipi → hedef araç sayısı (R5 aralığı) + sefer sayısı | `GunTalep[]` | Talep > filo ise bloke |
| A5 | Aday havuzu: `arac.durum = Aktif`, izin/arıza yok, R12 uyumlu, gün için müsait | Gün × grup aday listesi | Havuz boşsa R5 yumuşak ihlal |
| A6 | Greedy atama: her (gün, grup) için skor maksimize eden aracı seç (R1 korunur) | Taslak `atama` | — |
| A7 | Sefer dağıtımı: günün seferleri atamalara `sira_no` ve `vardiya` ile paylaştırılır | `atama_sefer` | Sefer sayısı > kapasite → R2 ihlali |
| A8 | Nöbet ataması: plaka başına **tek** nöbet günü (`nobet_gunu`, Tip B `×`) + `NÖBET` kolonundan gelen `nobet_kodu` (Tip A); araç seçimi en az nöbet almışlardan (R9 denge sinyali) | `nobet` | Nöbet tanımı boşsa atla |
| A9 | Kalan uygun araçlar → `durum = Yat` (R4) | `atama` YAT satırları | — |
| A10 | Doğrulayıcı (§8) çalıştır | `kural_ihlali` listesi | Sert ihlal → A11 |
| A11 | Repair döngüsü (en fazla `MaxRepairIterations = 2000`) | Düzeltilmiş plan | İyileşme yoksa dur, ihlalleri raporla |
| A12 | `uretim` kaydı kapat (`sure_ms`, `durum`) | — | — |

### 7.3 Seçim stratejisi ve skor fonksiyonu

Greedy: her (gün, grup) için aday araçlar skora göre sıralanır, en yüksek skorlu **uygun** araç atanır. Sıralama deterministik (eşit skorda `arac_id` artan).

```
S(arac, gun, grup) =
    w_rot   * rotasyon_uyum(arac, grup, gun)      // R7: g0 ve önceki hafta sırası
  + w_nobet * nobet_denge(arac)                    // R9 sert kuralı sağlandıktan sonra denge sinyali: 1 / (1 + son4HaftaNobet)
  + w_sira  * sira_devam(arac, grup, oncekiHafta)  // F5: önceki sırayı koru
  + w_grup  * grup_butunlugu(arac, grup, gun)      // aynı grup–gün birlikte
  + w_uyum  * hat_uyum(arac, gunun_hatlari)        // R12 ön eleme sonrası tercih
  + w_yuk   * yuk_dengesi(arac, gun)               // günlük sefer sayısı sapması
  - w_ceza  * yumusak_ihlal_sayisi(aday)           // R5,R6,R13
```

| Ağırlık | Varsayılan | Aralık | Etki |
| --- | --- | --- | --- |
| `w_rot` | 40 | 0–100 | Rotasyon uyumu (R7) |
| `w_nobet` | 20 | 0–100 | Nöbet dengesi (R9 sert kuralı sağlandıktan sonra eşit çözümler arasında tercih) |
| `w_sira` | 15 | 0–100 | Sıra sürekliliği (F5) |
| `w_grup` | 10 | 0–100 | Grup bütünlüğü (R14) |
| `w_uyum` | 10 | 0–100 | Donanım/hat tercihi |
| `w_yuk` | 5 | 0–100 | Günlük yük dengesi |
| `w_ceza` | 30 | 0–200 | Yumuşak ihlal cezası |

Ağırlıklar `uretim.parametre_json`'a yazılır → plan hangi parametreyle üretildiği geri izlenebilir (TD-11).

> R7 O4 (2026-10-27) ile **sert** kuraldır: rotasyon günü ihlali onayı bloke eder. `w_rot` bu nedenle sert kısıtı gevşetmez; yalnızca sert kuralları sağlayan eşit çözümler arasında tercih ağırlığıdır (TD-34).

### 7.4 Repair döngüsü

| Hamle | Tanım | Kabul koşulu |
| --- | --- | --- |
| `Swap` | İki aracın aynı gündeki atamalarını değiştir | Sert ihlal üretmiyor **ve** toplam skor artıyor |
| `Move` | Bir aracı boş bir güne/göreve taşı | Aynı koşul |
| `YatSwap` | Görevli araç ile yatan araç yer değiştirir | Aynı koşul + R5 hedef aralığı korunur |
| `NobetRebalance` | Nöbeti en yüksek araçtan en düşüğe aktar | R9 iyileşiyor |
| Yasak | Kilitli (`kilitli=1`) hücreye dokunmak | R8 |
| Durdurma | İyileşme yok, `MaxRepairIterations` doldu veya tüm yumuşak ihlaller kapandı | — |

Repair **sert ihlali asla üretmez**; yalnızca mevcut sert ihlali kapatmaya çalışır (A11 girişinde sert ihlal varsa hedef odur).

### 7.5 Determinizm

| Kural | Uygulama |
| --- | --- |
| Rastgelelik | `new Random(seed)` — başka rastgelelik kaynağı yok; `Guid.NewGuid()`, `DateTime.Now` skor içinde yasak |
| Sıralama | Tüm aday listeleri `(skor DESC, arac_id ASC)` ile sabit; `Dictionary` iterasyon sırasına güvenilmez |
| Paralellik | Üretici içinde `Parallel.For` yok (birleştirme sırası determinizmi bozar) |
| Kültür | Sayı/tarih formatı `CultureInfo.InvariantCulture`; `tr-TR` yalnızca UI |
| Tekrar testi | Aynı girdi + aynı seed → `atama` satırlarının hash'i aynı (§10 T11) |
| Seed kaydı | `uretim.seed` + `uretim.motor_surumu`; motor değişince eski plan "farklı sürüm" olarak işaretlenir |

### 7.6 Performans hedefi

| Ölçüt | Hedef | Ölçüm |
| --- | --- | --- |
| Atama sayısı | 45 araç × 7 gün = **315** | — |
| Sefer sayısı `N` | ≤ 3.000 / hafta (**varsayım**; docs/01'de sefer sayısı verisi yok) | `sefer` sayımı |
| Toplam süre | **< 1.000 ms** (A1–A12) | `uretim.sure_ms` + testte `Stopwatch` assert (§10 T12) |
| Repair | ≤ 2.000 hamle, ≤ 300 ms | Sayaç |
| Bellek | < 100 MB ek | — |
| Karmaşıklık | Greedy `O(gün × grup × aday log aday)` ≈ 7×6×45; repair sabit üst sınırlı | — |

Hedef tutmazsa: (a) `MaxRepairIterations` düşür, (b) `w_rot` ön elemesini aday havuzuna taşı, (c) sefer dağıtımını tek geçişe indir. Bu sıra `docs/02` R3'teki yaklaşımla aynı mantık.

### 7.7 Neden tam CSP/ILP kütüphanesi yok

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| Greedy + skor + repair (bu tasarım) | Bağımlılık yok, açıklanabilir, deterministik, < 1 sn | Optimal garanti yok | **Seçildi** |
| Google OR-Tools CP-SAT | Gerçek optimallik, kısıt dili hazır | Yeni bağımlılık (`AGENTS.md`: sormadan ekleme yok); native binary → self-contained win/linux paketleme ve trim riski (docs/02 ADR-002); süre sınırı determinizmi bozar; ihlal "neden"i çözücüden okunamaz | v1'de **yok** |
| Elle yazılmış ILP (Simplex) | Bağımlılıksız | Kural setinin %60'ı yumuşak/ağırlıklı; ILP'de açıklama üretmek zor | Yok |
| Kural motoru (Rete/forward-chaining) | Kural eklemesi kolay | Plan **üretmez**, yalnızca doğrular | Yalnızca doğrulayıcıda (§8) |

Karar: greedy + repair. Geri dönüş yolu: `IPlanOptimizer` portu (Application katmanı) — yarın OR-Tools eklenirse yalnızca yeni bir implementasyon yazılır, Domain/şema değişmez (tasarım kararı, TD-28).

---

## 8) Doğrulayıcı (validator)

### 8.1 Sözleşme

```csharp
// KbPlan.Application/Rules/
public interface IPlanRule
{
    string Code { get; }              // "R1".."R16"
    RuleSeverity Severity { get; }    // Bloke | Uyari | Bilgi
    IEnumerable<Violation> Check(PlanContext context);
}
```

`PlanContext`: hafta + 7 gün + atamalar + nöbetler + araç/hat sözlükleri + önceki hafta özeti. Kural sınıfları **saf** (yan etkisiz, veritabanı erişimi yok) — docs/02 ADR-003.

### 8.2 Kural → kontrol fonksiyonu

| Kod | Kontrol fonksiyonu | Baktığı veri | Sert/Yumuşak |
| --- | --- | --- | --- |
| R1 | `CheckSingleDutyPerDay` | `atama` gruplama (`gun_id, arac_id`) | Sert |
| R2 | `CheckTripUniqueness` | `atama_sefer` gruplama (`gun_id, sefer_id`) | Sert |
| R3 | `CheckVehicleAvailability` | `arac.durum`, `atama.durum` | Sert |
| R4 | `CheckYatConsistency` | `atama.durum`, `hat_id`, `vardiya_id` | Sert |
| R5 | `CheckDailyHeadcount` | gün tipi + `durum=Gorevli` sayımı | Yumuşak |
| R6 | `CheckWeekendCoverage` | gün tipi bazlı sayım | Yumuşak |
| R7 | `CheckRotationAlignment` | `gorev_grubu.referans_gun`, `gun.gun_sirasi`, `w` | Sert |
| R8 | `CheckLockedDutiesUnchanged` | `atama.kilitli`, önceki plan kopyası | Sert |
| R9 | `CheckStandbyRule` | `nobet` (hafta başına `arac_id` sayımı) + `nobet_kodu` varlığı | Sert |
| R10 | `CheckRestTime` | `vardiya` saatleri, ardışık gün atamaları | Sert |
| R11 | `CheckDayOffset` | `sefer/vardiya.gun_kaymasi` vs `bitis_saat` | Sert |
| R12 | `CheckVehicleRouteFit` | `hat.klima_gerekli/engelli_gerekli` vs `arac.*` | Sert |
| R13 | `CheckGroupSize` | `gorev_grubu.arac_sayisi` vs sayım | Yumuşak |
| R14 | `CheckGroupSingleDay` | `atama.gorev_grubu_id` × `gun_id` | Sert |
| R15 | `CheckWeeklyTotal` | `hafta.toplam_arac_gun` vs gün toplamı | Sert |
| R16 | `CheckTripDayType` | `sefer.gun_tipi` vs `gun.gun_tipi` | Sert |
| R17 | `CheckStandbyBalance` | `nobet` (bu hafta + son 6 hafta) araç başına gün sayımı vs filo | Yumuşak |
| R18 | `CheckStandbyRestDay` | `nobet.nobet_gunu` vs ertesi gün `atama(durum=Gorevli)` | Yumuşak |

### 8.3 İhlal çıktı modeli

| Alan | Tip | Açıklama |
| --- | --- | --- |
| `kural_kodu` | string | `R1`…`R16`, içe aktarma için `I-01`… |
| `siddet` | enum | `Bloke`, `Uyari`, `Bilgi` (DB'de 0/1/2) |
| `hafta_id` | int? | — |
| `gun_id` | int? | Hücreye atlamak için |
| `arac_id` | int? | Hücre koordinatı |
| `atama_id` | int? | Doğrudan satır |
| `mesaj` | string | Türkçe, tek cümle, sayısal değer içerir |
| `oneri` | string? | Repair'in önerdiği düzeltme ("205 ile yer değiştir") |

Örnek JSON (UI'ya ve `04-excel-io` hata raporuna aynı model gider):

```json
{
  "kuralKodu": "R7",
  "siddet": "Uyari",
  "gunId": 5,
  "aracId": 118,
  "atamaId": 2043,
  "mesaj": "Toki grubu bu hafta ÇARŞAMBA gününde olmalıydı, CUMA gününe atanmış.",
  "oneri": "Grubu ÇARŞAMBA gününe taşı; 205 ve 286 yer değiştirir."
}
```

### 8.4 UI'da gösterim

| Yer | Gösterim | Kaynak |
| --- | --- | --- |
| Haftalık plan gridi | Hücre arka planı: **kırmızı** = `Bloke`, **amber** = `Uyari`; hücrede ⚠ ikonu | docs/02 §3.2 ekran 4 ("kural ihlali vurgusu") |
| Sağ panel "İhlaller" | Kural koduna göre gruplu liste; tıklayınca hücreye atlar | docs/02 §3.2 ekran 5 (Kurallar) |
| Kural detayı | Kural tanımı + mesaj + öneri + "yoksay" (yalnızca `Uyari`) | — |
| Durum çubuğu | "3 bloke, 7 uyarı" + "Onayla" düğmesi pasif | — |
| Excel dışa aktarma | `Bloke` varsa çıktı üretilmez; hata raporu sayfası | §8.5 |

Erişilebilirlik: renk tek başına anlam taşımaz; ⚠ ikonu + metin zorunlu (renk körlüğü).

### 8.5 Üretimi/onayı bloke eden ihlaller

| Kural | Neden bloke |
| --- | --- |
| R1, R2 | Plan fiziksel olarak imkânsız (aynı araç/sefer iki yerde) |
| R3 | Görev alamayacak araç planda (saha gerçeğiyle çelişir) |
| R4 | Veri tutarsız (YAT satırı görev taşıyor) |
| R7 | Rotasyon resmî kuraldır (O4): grup yanlış güne atanmış plan onaylanamaz |
| R8 | Kullanıcının elle yaptığı düzeltme ezilmiş |
| R9 | H4 kanıtı %100: haftada birden fazla nöbet günü veya kodu olmayan nöbet kaydı planı geçersiz kılar |
| R10, R11 | Yasal/operasyonel dinlenme ve gün sınırı |
| R12 | Donanım yetersizliği → sefer yapılamaz |
| R14, R16 | Rotasyon/tarife sözleşmesi bozuk |
| R15 | Kaynak tabloyla sayı uyuşmuyor (içe aktarım güvenilmez) |

Yumuşak ihlal (R5, R6, R13, R17, R18) onayı **bloke etmez**; onay ekranında "gerekçe" alanı ister ve `duzeltme(kaynak=Kullanici, tur=Not)` olarak iz bırakır. R7 (O4, TD-34) ve R9 (H4, TD-37/TD-38) artık sert olduğu için bu listede değildir.

---

## 9) İçe aktarma / legacy

### 9.1 Kaynak tablolar (docs/01 §2)

| Tip | Yapı | Çıkarılan veri |
| --- | --- | --- |
| **A** (matris) | satır = gün (Pazar üstte → Pazartesi altta), kolon = plaka, hücre = kod; en üst satır `NÖBET`; sağ kolon günlük araç sayısı; alt satır `PLÂKALAR` 1–41 | **İkincil kaynak (O2)**: yalnızca çapraz doğrulama ve eksik hücre tamamlama; `atama` (hat numarası + gün + plaka), `nobet` (üst satır), `hafta.toplam_arac_gun` (sağ üst) |
| **B** (dikey rotasyon) | kolon = gün (Pzt→Paz), satır = sıralı plaka; `YAT` ayırıcı; kolon üstü not = görev grubu; daireli sayılar = sıra | **Esas kaynak (O2)**: önce bu tablo okunur; `atama.sira_no`, `atama.hat_no`, `atama.durum = Yat`, `nobet` (`x` işareti), `gorev_grubu` |

### 9.2 Çıkarma kuralları

| # | Kural | Sonuç |
| --- | --- | --- |
| I-01 | Hücre kodu `hat.hat_kodu` ile eşleşiyorsa `hat_id` dolar; `atama.gorev_kodu_ham` her durumda yazılır | TD-08 |
| I-02 | Boş hücre = **kayıt yok**; `YAT` = açık `durum=Yat` kaydı. Boş hücre YAT'a çevrilmez | docs/01 §3 (`YAT` ayrı ayırıcı) |
| I-03 | Üstü çizik hücre (`×253`, `×229`) → `atama.durum = Iptal` + `duzeltme(tur=UstuCizme)`; `Iptal` yalnızca elle doğrulanmış işaretle yazılır, hücredeki `x` iptal sayılmaz (TD-33) | docs/01 §7; O3 (2026-10-27) |
| I-04 | Kırmızı çapraz tarama (kolon/satır bandı) → o gün/araç için kayıt üretilmez + `duzeltme(tur=Tarama)` | docs/01 §7 |
| I-05 | Kolon başlığı üstü elle plaka (`229`, `225`, `134`, `186`) → `arac(kaynak='elle')` + `duzeltme(tur=KolonBasligi)` | docs/01 §5, §7; O5 (2026-10-27), TD-36 |
| I-06 | Okuma sırası: **önce Tip B** (esas), sonra Tip A (çapraz doğrulama). Çelişirse Tip B kazanır (hat numarası, `sira_no`, `YAT`, nöbet işareti); Tip A yalnızca doğrulama ve eksik hücre tamamlama için kullanılır; çelişki `kural_ihlali(kural_kodu='I-06', siddet=Uyari)` olarak yazılır | O2 (kullanıcı onayı 2026-10-27); TD-35 (TD-29'un önceliğini günceller) |
| I-07 | Okunamayan hücre → kayıt üretilmez, `kural_ihlali(kural_kodu='I-07', siddet=Bloke, mesaj="G13 ... okunamadı")`; hafta "doğrulanmadı" işaretlenir | docs/01 §1 (okunabilirlik), Ek (yöntem sınırları) |
| I-08 | Mükerrer görsel (`mukerrer_mi=1`) ikinci kez aktarılmaz | docs/01 §1.1 (5 mükerrer çekim) |
| I-09 | `hafta.toplam_arac_gun` tabloda yazılıysa saklanır ve R15 ile karşılaştırılır | docs/01 §4, §9/5 |
| I-10 | Başlıksız matris (G13, G16) haftaya **bağlanmaz**; `gorsel_kaynak.hafta_id = NULL` + `varsayim_mi=1` | docs/01 §9/19 |

### 9.3 Kod normalizasyonu (belirsiz alanlar → varsayım)

Kaynak: docs/01 §3 ve §9/1–17. Her satır `atama.varsayim_mi = 1` ve `gorev_kodu_ham` ile birlikte yazılır.

| Ham kod | Yorum | Varsayım etiketi | Etki |
| --- | --- | --- | --- |
| `A`, `S` | Vardiya tipi | docs/01 §3 (en olası) | `vardiya_id` |
| `7A`, `8A`, `9A`, `10A`, `12A`, `26A…27E` | Hat kodu | docs/01 §3 | `hat_id` |
| `9AT` | Hat `9A` + `T` = "tam gün" | **varsayım** (docs/01 §9/2) | `hat_id` = 9A, `not_metni` = "9AT" |
| `A1` / `1A` | A vardiyası + 1. sefer | **varsayım** (docs/01 §9/3) | `vardiya_id` = A, `sira_no` = 1 |
| Tek rakam `2`,`5`,`6`,`7` … | **Hat numarası** | **ONAYLANDI** (2026-10-27, O1) | `atama.hat_no` (+ sözlükte varsa `hat_id`); `sefer_sayisi` **türetilmez** (TD-30, TD-31) |
| `-20`, `-13`, `-15`, `-108` | **Negatif kod = ek görev** (`-20` => 20 hattına ilave görev) | **ONAYLANDI (2026-11-01, S14)** | `hat_no` = 20, ek görev işareti, `gorev_kodu_ham` = ham kod; kural tetikler |
| `x`, `X` (tek başına) | **Nöbet işareti = nöbet günü** | **ONAYLANDI** (2026-10-27, O3 + H4) | `nobet(tip = NobetIsareti, kaynak = Hucre, kaynak_tablo = 'rotasyon', nobet_gunu = gun_id)`; `atama` üretilmez (TD-32, TD-38) |
| `NÖBET` kolonu değeri (`5`, `6`, `20`) | **Nöbet günündeki hat kodu** | **ONAYLANDI** (2026-10-27, H4 + kullanıcı teyidi) | `nobet(kaynak_tablo = 'matris', nobet_kodu = ham değer)`; gün bilgisi Tip B'den gelir (TD-37); kod `hat` sözlüğüne çözülür, çözülemeyen kod `kural_ihlali` üretir (TD-39) |
| `5x`, `6x`, `4x`, `3x`, `2x` | Sayı = hat numarası (O1) + `x` = nöbet işareti (O3); birleşik anlam hâlâ varsayım | **kısmi** (O1 + O3) | `atama.hat_no` + `nobet` kaydı; `varsayim_mi = 1` |
| `12.00`, `13.00`, `20.30` | **Sefer başlangıç saati** (o aracın o günkü ilk seferi, örn. 12.00 = 12:00) | **ONAYLANDI (2026-11-01, S15)** | `Trip.StartTime` / atama ilk seferi eşlemesi; kural tetikler |
| `D`, `0-20` | Belirsiz | **karantina** (I-07) | kayıt üretilmez |
| `12G`, `12P` | Belirsiz (gündüz/pik?) | **karantina** (I-07) | kayıt üretilmez |
| `100`, `105`, `108` | Hat numarası (3 hane) | docs/01 §3 | `hat_no` |
| `NÖBET` hücresi `5/6/2` | **Nöbet günündeki hat kodu** | **ONAYLANDI** (2026-10-27, H4 + kullanıcı teyidi) | `nobet(kaynak_tablo = 'matris', nobet_kodu = ham değer)`; gün bilgisi Tip B `×`'ten gelir (TD-37); kod `hat` sözlüğüne çözülür (TD-39) |
| `(1)…(27)` daireli sayı | Rotasyon sırası | **varsayım** (docs/01 §3) | `atama.sira_no` |
| `(6) Toki` üst notu | Görev grubu + araç sayısı | docs/01 §3, §6.1 | `gorev_grubu_id` + `arac_sayisi` |
| `otogar`, `Demirci`, `Toli/Toki` | Yer/servis notu | **varsayım** (docs/01 §9/13) | `atama.not_metni` |

### 9.4 Denetim izi (`duzeltme`)

| Kural | Uygulama |
| --- | --- |
| Her içe aktarılan düzeltme | `duzeltme(kaynak=Gorsel, gorsel_kaynak_id, tur, eski_deger, yeni_deger, aciklama)` |
| Kullanıcının uygulamada yaptığı değişiklik | `duzeltme(kaynak=Kullanici, atama_id, eski_deger, yeni_deger)` + `atama.elle_duzeltme = 1`, `atama.kilitli = 1` |
| Kilit açma | Yalnızca açık kullanıcı işlemi; `duzeltme(tur=Not, aciklama="kilit açıldı")` |
| Silme yok | Düzeltme kaydı hiç silinmez (P6); yanlış düzeltme yeni kayıtla düzeltilir |
| Rapor | "Bu hücreye kim dokundu?" → `atama` + `duzeltme` join, zaman sıralı |

### 9.5 Aktarım sırası (docs/01 §10 ile uyumlu)

| Adım | İş | Kapı |
| --- | --- | --- |
| 1 | `gorsel_kaynak` 21 kayıt (mükerrer işaretli) | I-08 |
| 2 | `arac` 45 kayıt (41 basılı + 4 elle, `kaynak` alanı ile işaretli) | O5 onaylandı (2026-10-27): 45 plaka; S8 onayı |
| 3 | `hat` sözlüğü (doğrulanan kodlar + O1 ile tek rakamlı hat numaraları) | O1 onaylandı (2026-10-27); §11 S2–S3 onayı |
| 4 | `hafta` + 7 `gun` (başlık tarihlerinden) | docs/01 §1.1 |
| 5 | Pilot hafta: **önce G09 (Tip B, esas)**, sonra G08 (Tip A, çapraz doğrulama) | O2 (2026-10-27); R15 ile `=66`/`=76` karşılaştırması |
| 6 | Kalan 7 hafta | I-07 karantina listesi boşalınca |

---

## 10) Test planı

M1 = şema/persistence, M3 = motor/doğrulayıcı. Toplam **18 senaryo** (en az 12 isteniyordu).

| # | Test adı | Faz | Girdi | Beklenen çıktı | Kural |
| --- | --- | --- | --- | --- | --- |
| T01 | `UniquePlateIndex` | M1 | Aynı `plaka` iki kez eklenir | `DbUpdateException` (unique ihlali) | §3.4/1 |
| T02 | `DutyUniquePerVehicleDay` | M1 | Aynı (hafta, gün, araç) iki atama | Reddedilir | R1 |
| T03 | `YatConsistencyCheck` | M1 | `durum=Yat` + `hat_id` dolu | CHECK ihlali | R4 |
| T04 | `WeekDayCardinality` | M1 | Hafta oluşturulur, 7 gün eklenir | `gun_sirasi` 1–7, `tarih` tekil, `gun_tipi` Cumartesi=2 | §3.2.5 |
| T05 | `DayTypeCheckConstraint` | M1 | `gun_sirasi=6`, `gun_tipi=1` | CHECK ihlali | §3.2.5 |
| T06 | `MigrationFromEmpty` | M1 | Boş DB → son migration | 14 tablo + tüm indeksler mevcut | §4.4 |
| T07 | `SeedIdempotent` | M1 | Seed iki kez çalıştırılır | 45 araç, 4 grup, 6 vardiya; satır sayısı değişmez | §3.5 |
| T08 | `ForeignKeyRestrict` | M1 | `atama` varken `arac` fiziksel silinir | RESTRICT hatası | TD-21 |
| T09 | `RotationFormulaSevenWeeks` | M3 | 4 grup × `w=-1..5` | §6.5 tablosuyla 12/12 + F4 periyot eşitliği | R7 |
| T10 | `RotationWrapNegativeWeek` | M3 | `w=-1` ve `w=6` | Aynı gün sırası | R7, F4 |
| T11 | `GenerationDeterministic` | M3 | Aynı girdi + `seed=42`, iki kez | `atama` satır hash'i aynı | §7.5 |
| T12 | `GenerationPerformance` | M3 | 45 araç, 7 gün, 3.000 sefer | `sure_ms < 1000` | §7.6 |
| T13 | `LockedDutyPreserved` | M3 | Kilitli hücre + üretim | Kilitli hücre değişmez, `elle_duzeltme=1` kalır | R8 |
| T14 | `UnavailableVehicleExcluded` | M3 | `arac.durum=Bakim` + `atama.durum=Arizali` | Araç hiçbir göreve atanmaz | R3 |
| T15 | `NoTripDoubleBooking` | M3 | Aynı sefer iki araca | R2 bloke ihlali döner, üretim bloke | R2 |
| T16 | `StandbyBalanceSoft` | M3 | 4 hafta nöbet geçmişi + yeni hafta | `nobet` toplamı ±1 aralığında; ihlal varsa `Uyari` (R9 sert kuralı ayrı: haftada en fazla 1 nöbet günü) | R9 |
| T17 | `WeekendHeadcountRule` | M3 | Cmt/Paz hedefi 20, üretim 8 araç | R6 `Uyari` üretir, onay bloke olmaz | R5, R6 |
| T18 | `ImportAssumptionFlags` | M2/M1 | G09 (Tip B) pilot aktarımı | `varsayim_mi=1` satırlar raporlanır; `YAT` satırları `durum=1`; `duzeltme(kaynak=Gorsel)` sayısı = işaretli hücre sayısı | §9.2, §9.4 |

Ek zorunlu birim testleri (M1 kapsamı, tabloya sığmadı): değer dönüştürücüleri (T19 `DateOnlyRoundTrip`, T20 `TimeOnlyMidnightAndCrossDay`, T21 `EnumStoredAsInt`) — docs/02 R6 sınır değerleri (23:59, 00:00).

**Test altyapısı:** xunit.v3 + FluentAssertions 7.2.2 (docs/02 ADR-009); SQLite testleri gerçek dosya (temp), `Microsoft.Data.Sqlite` in-memory değil (WAL/PRAGMA davranışı gerçekçi olsun).

> .NET SDK 10.0.403 kuruldu (2026-10-27, $HOME/.dotnet, global.json pin); bu doküman yazıldığında testler henüz **çalıştırılmadı** — M1'de `dotnet test` ile doğrulanacak (docs/02 R1: kapandı).

---

## 11) Açık varsayımlar (docs/01 §9'un 20 sorusu)

`Etkiler` = bu tasarımdaki bir kararı değiştirir mi. `Onay` = "kullanıcı onayı gerekli".
Numaralandırma `docs/01` §9 ile birebirdir; aynı sorular `docs/06-open-questions.md` Bölüm A'da **S1–S20** kodlarıyla izlenir (S10 = NÖBET semantiği).

| # | Soru (docs/01 §9) | Etkiler | Seçilen varsayılan | Onay |
| --- | --- | --- | --- | --- |
| S1 | Tek rakam kodlar (`2`,`5`,`6`,`7`) sefer sayısı mı, hat no mu? | **Evet** | **Hat numarası** → `atama.hat_no`; `sefer_sayisi` hücreden türetilmez (TD-30, TD-31) | **ONAYLANDI (2026-10-27)** — O1 |
| S2 | `9AT`'deki `T` nedir? | **Evet** | `T` = tam gün; hat = `9A`; `not_metni` ham kodu taşır | **kullanıcı onayı gerekli** |
| S3 | `A1` ile `1A` aynı mı? | **Evet** | İkisi de A vardiyası + 1. sefer; `1A` hat kodu olarak **kullanılmaz** | **kullanıcı onayı gerekli** |
| S4 | Günlük araç sayısı gerçekten araç sayısı mı? | **Evet** | Araç sayısı (R5 hedef aralığı bu varsayıma bağlı) | **kullanıcı onayı gerekli** |
| S5 | Okunamayan toplamlar (`=66`, `=65`, `=71`, `=126`) | Hayır (veri kalitesi) | Tablo değeri saklanır, R15 uyuşmazsa hafta "doğrulanmadı" | kullanıcı onayı gerekli |
| S6 | `221` mi `229` mu? | **Evet** (filo) | **ONAYLANDI (2026-10-27): 45 plaka, elle yazılan `229`/`225` ek kayıt** — `229` geçerli ek kayıt (`kaynak='elle'`), `221` basılı olarak listede kalır (`kaynak='basili'`, TD-36) | **ONAYLANDI (2026-10-27)** — O5 |
| S7 | `085` mi `225` mi? | **Evet** (filo) | **ONAYLANDI (2026-10-27): 45 plaka, elle yazılan `229`/`225` ek kayıt** — `225` geçerli ek kayıt (`kaynak='elle'`), `085` basılı olarak listede kalır (`kaynak='basili'`, TD-36) | **ONAYLANDI (2026-10-27)** — O5 |
| S8 | `080` neden elle yazılmış? | **Evet** (filo) | Sonradan eklendi; `kaynak='elle'` işareti (TD-36) | kullanıcı onayı gerekli |
| S9 | Plaka→gün eşlemesi hangi tablodan doğrulanır? | **Evet** | **Esas kaynak Tip B** (gün = kolon, plaka = dikey liste); Tip A matris ikincil/çapraz doğrulama (I-06, TD-35) | **ONAYLANDI (2026-10-27)** — O2 |
| S10 | `NÖBET` hücresindeki `5/6/2` ne? | **Evet** | **ONAYLANDI (2026-10-27):** `x` = nöbet günü, `NÖBET` kolonu = nöbet günündeki **hat kodu** (H4, %100 eşleşme) → `nobet_gunu` (Tip B) + `nobet_kodu` (Tip A) → `hat_id` çözümü zorunlu (TD-37, TD-38, TD-39); R9 sert. Kalan tek belirsizlik: `×` gün sınırı | **ONAYLANDI (2026-10-27)** |
| S11 | `YAT` bloğu kuralı nedir? | **Evet** | Rotasyon + uygunluk sonucu; arıza/izin ayrı neden (`atama.durum`) | **kullanıcı onayı gerekli** |
| S12 | `2. Töre` nedir? | **Evet** | Grup ön eki (`gorev_grubu.on_ek`); parantez içi = araç sayısı | **kullanıcı onayı gerekli** |
| S13 | `otogar`, `Demirci`, `Toli/Toki` notları | **Evet** (kısmi) | Serbest not → `atama.not_metni`; kural üretmez | kullanıcı onayı gerekli |
| S14 | `-20`, `-13`, `-108` eksi kodlar | **Evet** | **ONAYLANDI (2026-11-01):** negatif kod = ek görev (`-20` => 20 hattına ilave görev); ham kod `gorev_kodu_ham`'da saklanır, normalize edilirken hat numarası çıkarılır ve ek görev olarak işaretlenir | **ONAYLANDI (2026-11-01)** |
| S15 | `12.00`, `20.30` saat mi? | **Evet** | **ONAYLANDI (2026-11-01):** değer sefer başlangıç saatidir (örn. 12.00 = 12:00); o aracın o günkü ilk seferi | **ONAYLANDI (2026-11-01)** |
| S16 | Kolon üstü `(4) (20)` / `(7A) (9)` çiftleri | **Evet** | İki hat kodu; ikincisi `not_metni`'ye, ilki `hat_id` | **kullanıcı onayı gerekli** |
| S17 | `12G` / `12P` ne? | **Evet** (kısmi) | Belirsiz → karantina (I-07), kayıt üretilmez | kullanıcı onayı gerekli |
| S18 | Hafta sonu tarifesi neden farklı? | **Evet** | Gerçek kabul edildi; R6 yumuşak kural | **kullanıcı onayı gerekli** |
| S19 | Başlıksız matrisler (G13, G16) hangi haftaya ait? | Hayır (aktarım) | `gorsel_kaynak.hafta_id = NULL` + `varsayim_mi=1` | kullanıcı onayı gerekli |
| S20 | 7 haftalık döngü resmi kural mı? | **Evet** | **Resmî kural** (O4); R7 **sert** — ihlal onayı bloke eder (TD-34) | **ONAYLANDI (2026-10-27)** — O4 |

**Özet (2026-11-01 günceli):** 20 sorunun **18'i** tasarımı etkiliyor; **8'i onaylandı** (S1 → O1, S6/S7 → O5, S9 → O2, S10 → H4 + kod = hat kodu, S14 → ek görev, S15 → sefer başlangıç saati, S20 → O4); S10'da açık alt soru kalmadı, kalan tek belirsizlik `×` gün sınırı. Kalan onay bekleyenler: S2, S3, S4, S11, S12, S16, S18.
Tasarımı etkilemeyenler: S5 (veri kalitesi), S19 (aktarım eşlemesi).

### 11.1 Onay gelmezse ne olur?

| Onay durumu | Davranış |
| --- | --- |
| Onaylanmadan M1 şeması | Şema **donar** (docs/05 R4); onay sonrası değişiklik yeni migration gerektirir |
| Onaylanmadan M3 kuralları | Varsayılan ağırlıklarla üretim yapılır, ihlaller `varsayim_mi=1` olarak raporlanır |
| S1/S4 onayı gecikirse | S1 onaylandı (O1) → hücre hat numarası olarak yazılır; S4 gecikirse "hedef araç sayısı" yanlış olabilir → pilot hafta (G09+G08) doğrulaması zorunlu |

---

## 12) Doküman dışı düzeltme talepleri (sahiplik dışı)

| # | Dosya | Sorun | Öneri |
| --- | --- | --- | --- |
| 1 | `docs/00-glossary.md` | `NOBET` tanımı "hizmet aralığı" diyor; `docs/01` §3/§4 nöbeti gece nöbeti satırı olarak tanımlıyor | `NOBET` → nöbet kaydı; "hizmet aralığı" tanımı `VARDIYA` maddesine taşınsın (koordinatör kararı 2026-10-27) |
| 2 | `docs/00-glossary.md` | `GOREV` maddesi "araç + sefer saatine atanmış iş" diyor; bu dokümanda görev = `atama` (gün×araç), sefer ayrı | Tanım `ATAMA` maddesi olarak güncellensin |
| 3 | `docs/05-roadmap.md` §2 (M1) | "41 plakalık filo seed" — `docs/01` §5 toplam 45 farklı numara veriyor (41 basılı + 4 elle) | M1 kabul ölçütü "45 araç (41 basılı + 4 elle, `kaynak` işaretli)" olarak düzeltilsin |
| 4 | `docs/02-architecture.md` §2.2 | Domain entity listesi yalnızca 5 varlık (`Vehicle, Route, Trip, Duty, Shift`) sayıyor | Liste §2.4 ile hizalanmalı (14 varlık) |
| 5 | `docs/06-open-questions.md` Bölüm A | S10 **H4 (2026-10-27) ile işlendi** (`docs/06` S10 satırı ONAYLANDI) | NÖBET kodu = hat kodu onaylandı (TD-39); kalan tek belirsizlik `×` gün sınırı; `varsayim_mi` alanı kaldırılmaz, geçmiş kayıt korunur |

---

## 13) Doğrulama durumu

| Kontrol | Durum |
| --- | --- |
| 11 zorunlu bölüm dolu | ✅ §1–§11 (+ §12, §13 ek) |
| Fiziksel şemada varlık sayısı | **14** (≥ 8) |
| Kural kataloğu | **16** (13 sert / 3 yumuşak); 10'u docs/01 gözleminden; R7 (O4) ve R9 (H4) sert |
| Test senaryosu | **18** (+3 ek birim testi = 21) |
| Varsayım | **20** sorunun 18'i etkiliyor; 8'i onay bekliyor, 6'sı onaylandı (S1, S6, S7, S9, S10, S20) |
| Kullanıcı onayları | O1–O5 işlendi (2026-10-27); NÖBET semantiği H4 ile işlendi; NÖBET kodu = hat kodu onaylandı (2026-10-27, TD-39) |
| Rotasyon örnek hafta | **3 hafta × 4 grup = 12 hücre**, 12/12 eşleşti |
| `dotnet build` / `dotnet test` | **doğrulanmadı: bu doküman turunda çalıştırılmadı**; SDK 10.0.403 kuruldu (2026-10-27), M1'de çalıştırılacak |
