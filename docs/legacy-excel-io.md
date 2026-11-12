# 04 — Excel İçe/Dışa Aktarma Tasarımı

> **Son güncelleme:** 2026-11-01 (K1/D1 kararı: `proje resimleri/` G01–G21 görsellerinden gerçek şablon yerleşimi analizi ve hücre eşleme tabloları eklendi).

| Alan | Değer |
| --- | --- |
| Doküman | `docs/04-excel-io.md` |
| Durum | Hazır (v2) — G01–G21 basılı plan görsellerinden fiziksel hücre eşlemesi çıkarıldı (§2.7, §4.1) |
| Girdi | `docs/01-domain-analysis.md` §2, §3, §4, §5, §7, §8, §9, §10 · `docs/02-architecture.md` §2.2, §4, §7.3, §11 (ADR-006, ADR-011) · `docs/03-data-model-and-scheduler.md` §3–§5 |
| Veri modeli kaynağı | `docs/03-data-model-and-scheduler.md` §2.4 (14 varlık, `atama_sefer`, `vardiya` FK) esas alındı; erken taslak `docs/01` §8 idi |
| Kütüphane | ClosedXML 0.105.1 (MIT) — `docs/02` §4.2 / ADR-006. Yedek: DocumentFormat.OpenXml 3.5.1 |
| Son güncelleme | 2026-11-01 (K1/D1 görsel yerleşim analizi + O1–O5 kararları) |

> **Temel kısıt:** Şablon `.xlsx` dosyası bu makinede yok (`find` ile arandı, `proje resimleri/` altında yalnızca 21 JPEG var). Bu yüzden belgedeki tüm hücre konumları **mantıksal isim** ile yazılmıştır (`PLAN_GUN_ETIKET`, `ROT_YAT_ISARET` gibi). Fiziksel adresler §2.5'teki **şablon keşfi adımı (KE)** tamamlanınca `templates/fields.json` dosyasına yazılır; koda gömülmez (`docs/02` §4.3 adım 2).

---

## 0) Kullanıcı onayları (2026-10-27) ve Excel tasarımına etkisi

Kullanıcı 2026-10-27'de O1–O4 kararlarını onayladı. Aşağıdaki tablo her onayın hücre okuma/yazma kurallarına etkisini ve dokunulan bölümleri verir. O5 (S6/S7) **onaylandı (2026-10-27): filo 45 plaka**; `Arac.kaynak` alanı (`basili`/`elle`) bu kararla işaretlenir.

| Kod | Karar | Excel İO'ya etkisi | Etkilenen bölümler |
| --- | --- | --- | --- |
| **O1** (S1) | Hücredeki tek rakam kodlar (`2`,`5`,`6`,`7` …) = **hat numarası** | §3.3/§4'te tek rakam satırı `Hat.hat_no`'ya bağlanır; `sefer_sayisi` hücreden **türetilmez** (yalnızca elle girilen/hesaplanan alan); `W-IMP-022` mesajı hat numarası olur | §3.3, §3.4, §4, §5.2, §5.3, §7.1, §10 |
| **O2** (S9) | Esas kaynak **Tip B** (gün = kolon, plaka = dikey liste); Tip A ikincil | İçe aktarma akışında **önce Tip B** okunur, Tip A yalnızca çapraz doğrulama; V-08 varsayımı tersine döndü | §2.1, §2.2, §3.1, §3.2, §10.1, §10.2 |
| **O3** | Hücredeki `x` = **nöbet işareti** (iptal değil) | `x` hücresi `Nobet` kaydı üretir (`tip = NobetIsareti`, `kaynak = Hücre`); `Atama.durum = iptal` hücreden üretilmez (yalnızca elle); export'ta nöbet kaydı `x` olarak yazılır | §3.3, §4, §5.2, §5.3, §10.1 |
| **O4** (S20) | 7 haftalık görev grubu–gün kayması **resmî kural** | Excel katmanı değişmez: döngü plan motorunda (docs/03 R7 **sert**); Excel yalnızca yazar (V-17 korunur) | §10.1, §10.2 |
| **O5** | S6/S7 (`221`/`229`, `085`/`225`) **ONAYLANDI (2026-10-27): 45 plaka** — elle yazılan `229` ve `225` geçerli ek kayıt, basılı `221` ve `085` de listede kalır | Import sırasında iki değer de okunur, `Arac.kaynak` (`basili`/`elle`) alanıyla ayrılır; basılı değer silinmez (V-06) | §10.1, §10.2 |

Kurallar:

| # | Kural |
| --- | --- |
| 1 | Bu doküman şema tanımlamaz; hücre → model eşlemesi `docs/03` §3.2/§9.3 ile uyumlu tutulur. |
| 2 | O5 kapsamındaki S6/S7 satırları **ONAYLANDI (2026-10-27)**: 45 plaka; elle yazılan değer geçerli ek kayıt, basılı değer silinmez. |
| 3 | Onaylar dışında yeni varsayım üretilmedi; kalan belirsizlikler §10'da aynı etiketlerle duruyor. |

---

## 1) Amaç ve kapsam

### 1.1 Amaç

| # | Amaç | Ölçüt |
| --- | --- | --- |
| A1 | Kullanıcının elindeki **mevcut haftalık `.xlsx` planını** okuyup normalize modele (`docs/01` §8) aktarmak | 8 haftalık geçmiş plan hatasız içe aktarılır |
| A2 | Aynı şablonu **bozmadan** yeni hafta planını yazmak | Şablon hash'i değişmez; biçim/formül/yazdırma alanı korunur |
| A3 | İçe aktarmada karşılaşılan belirsizlikleri **kullanıcıya Türkçe raporlamak** | Her belirsiz hücre için satır/hücre/mesaj |
| A4 | Dışa aktarma öncesi planı **doğrulamak** (çakışma, eksik atama) | Validator raporu olmadan dosya yazılmaz |
| A5 | Çıktının tekrar üretilebilir olması (golden-file test) | §8'deki 12 senaryo yeşil |

### 1.2 Kapsam içi

| # | Madde | Not |
| --- | --- | --- |
| K1 | Tip A (gün × plaka matrisi) sayfası okuma | `docs/01` §2 |
| K2 | Tip B (gün = kolon, plaka = dikey liste) sayfası okuma | `docs/01` §2 |
| K3 | Hücre kodu → `Atama`/`Hat`/`Nobet` eşlemesi | §3.3, §4 |
| K4 | Şablonu koruyan yazma (template-preserving) | `docs/02` §4.3 |
| K5 | Günlük sayım + hafta toplamı formüllerinin korunması | §5.4 |
| K6 | Şablon sürüm/keşif doğrulaması | §6 |
| K7 | İçe/dışa aktarma hata raporu ve loglama | §7 |
| K8 | Golden-file test altyapısı | §8 |

### 1.3 Kapsam dışı (v1)

| # | Madde | Gerekçe |
| --- | --- | --- |
| D1 | Şablonu **sıfırdan** üretmek | ADR-011: müşteri biçimi korunacak; sıfırdan üretim reddedildi |
| D2 | Excel COM interop / kurulu Excel gerektiren işlemler | Linux'ta yok (`docs/02` ADR-011) |
| D3 | `.xls` (BIFF) ve `.xlsm` (makro) yazma | ClosedXML `.xlsm` makrolarını korumaz (`docs/02` §4.3 risk notu) |
| D4 | Pivot tablo / slicer üretmek veya güncellemek | Kütüphane desteği yok; şablonda varsa "dokunma" politikası |
| D5 | Formül hesaplama motoru | ClosedXML hesaplamaz; Excel açılışta hesaplar (`FullCalcOnLoad`) |
| D6 | PDF çıktısı | `docs/05` K6 açık; v1 yalnızca `.xlsx` |
| D7 | Fotoğraftan (JPEG) otomatik plan okuma (OCR) | `docs/01` elle yapıldı; v1 kapsamı değil |
| D8 | CSV içe/dışa aktarma | `docs/02` §5.5 JSON ile yapılır; CSV riski R5 |
| D9 | Aynı anda iki dosya yazma (eşzamanlı export) | Tek kullanıcı kabulü (`docs/02` §5.2) |

---

## 2) Kaynak dosya varsayımı

Kaynak: kullanıcının elindeki, basılı tablonun dijital hâli olan `.xlsx`. İki sayfa düzeni aynı dosyada birlikte bulunabilir (Tip A + Tip B) veya tek sayfa olabilir.

### 2.1 Tip A — gün × plaka matrisi

> **Öncelik (O2, 2026-10-27):** Tip A **ikincil** kaynaktır. İçe aktarmada önce Tip B (§2.2) okunur; Tip A yalnızca çapraz doğrulama ve Tip B'de eksik kalan hücreleri tamamlamak için kullanılır.

| Bölge | İçerik | Veri mi, biçim mi | Mantıksal isim |
| --- | --- | --- | --- |
| Üst bant (1–3 satır) | Hafta tarih aralığı başlığı `26.10.2026 – 01.11.2026` | **Veri** (Hafta) | `PLAN_HAFTA_BASLIK` |
| Üst bant | Sayfa/başlık metni, kurum adı, birleşik hücreler | Biçim | `PLAN_BASLIK_BANDI` |
| 1. veri satırı | `NÖBET` etiketi + araç başına **nöbet günündeki hat kodu** (`5`, `6`, `20`) | **Veri** (Nobet, `nobet_kodu` → `hat`) | `PLAN_NOBET_SATIRI` |
| Sol kolon | Gün adları (Pazartesi en altta → Pazar en üstte) | **Veri** (Gun) | `PLAN_GUN_ETIKET` |
| Sol kenar (2–3 dar kolon) | `10 / 4-15`, `6 / 18` gibi yardımcı sayılar | **Belirsiz** — v1'de okunmaz, uyarı üretir | `PLAN_SOL_NOT` |
| Plaka kolon başlıkları | `003, 030, 042 …` | **Veri** (Arac) | `PLAN_PLAKA_BASLIK` |
| Alt satır | `PLÂKALAR` + 1…41 sıra numarası | Etiket (biçim) + sıra doğrulama | `PLAN_PLAKA_ALT_SATIR` |
| Gövde | Hücre kodu (`7A`, `A`, `9AT`, `5x`, `-20`, `6`) | **Veri** (Atama) | `PLAN_HUCRE_BLOK` |
| Sağ kolon | Gün başına araç sayısı (8, 4, 20, 20) | Hesaplanan (formül) | `PLAN_GUNLUK_SAYI` |
| Sağ üst | Hafta toplamı (`=76`) | Hesaplanan (formül) | `PLAN_HAFTA_TOPLAM` |

### 2.2 Tip B — dikey rotasyon (gün = kolon)

> **Öncelik (O2, 2026-10-27):** Tip B **esas kaynaktır** (gün = kolon, plaka = dikey liste). İçe aktarma akışında önce bu sayfa okunur; çelişkide Tip B kazanır (V-08 güncellendi).

| Bölge | İçerik | Veri mi, biçim mi | Mantıksal isim |
| --- | --- | --- | --- |
| Üst bant | Hafta tarih aralığı | **Veri** | `ROT_HAFTA_BASLIK` |
| Kolon üstü el yazısı | `2. Töre (6) Toki`, `2.Töre (2) F.Şelebi` | **Veri** (GorevGrubu) | `ROT_GRUP_NOTU` |
| Kolon üstü daireli çift | `(8) (10)`, `(7A) (9)` | **Veri** (ana hat/vardiya) | `ROT_GUN_ANA_HAT` |
| Gün başlık satırı | `PAZARTESİ … PAZAR` | **Veri** (Gun) | `ROT_GUN_BASLIK` |
| Gövde | Sıralı plaka listesi (`188, 286, 205 …`) | **Veri** (Atama + sira_no) | `ROT_PLAKA_SATIR` |
| Ayırıcı | `YAT` etiketi | **Veri** (durum) | `ROT_YAT_ISARET` |
| `YAT` altı | Görev almayan plakalar | **Veri** (`durum = YAT`) | `ROT_YAT_BLOK` |
| Kolon altı daireli dizi | `(12) (13) … (27)` | **Belirsiz** — sıra no olarak okunur, uyarı | `ROT_SIRA_DIZISI` |
| Kenar notları | `otogar`, `Demirci`, `Toli/Toki` | **Veri** (serbest not) | `ROT_SERBEST_NOT` |

### 2.3 Hücre sınıflandırma kuralı

| Sınıf | Tanım | Import davranışı |
| --- | --- | --- |
| Başlık hücresi | Birleşik aralık, kalın/ortalı, gün adı veya tarih bandı | Atlanır, yalnızca eksen tespitinde kullanılır |
| Etiket hücresi | `PLÂKALAR`, `NÖBET`, `YAT`, `toplam` | Sabit sözlükle eşlenir, `Atama` üretmez |
| Veri hücresi | `PLAN_HUCRE_BLOK` / `ROT_PLAKA_SATIR` içinde, boş olmayan | `Atama` üretir |
| Boş hücre | Değer yok veya yalnızca boşluk | `Atama` **üretilmez** (silinmiş görev değil) |
| Biçim hücresi | Kenarlık, dolgu, sayı biçimi, yazdırma ayarı | Okunmaz, korunur |

### 2.4 Birleşik hücreler ve başlık bantları

| Durum | Kural |
| --- | --- |
| Birleşik başlık (tarih aralığı 2–3 satıra yayılmış) | `MergedRanges` taranır; değer sol-üst hücreden bir kez okunur; kapsanan hücreler "boş" sayılmaz |
| Birleşik gövde hücresi (beklenmiyor) | Uyarı `W-IMP-031`; değer sol-üstten okunur, kapsanan hücreler atlanır |
| Başlık satırı sayısı değişken (1–4 satır) | Sabit satır numarası kullanılmaz; `PLAN_GUN_ETIKET` ilk dolu gün adından bulunur |
| Başlıkta yazım hatası (`04.09.2026` yerine `04.10.2026`) | Tarih aralığı 7 gün değilse uyarı `W-IMP-012`, kullanıcı onayı istenir (`docs/01` G12) |

### 2.5 Şablon keşfi adımı (KE) — zorunlu ön koşul

**Tanım:** Kullanıcıdan gelen `.xlsx` dosyasının yapısını bir kez çıkarıp `templates/fields.json` + `templates/template-manifest.json` dosyalarına yazan, kod yazmadan önce tamamlanması gereken adım. Bu adım kapanmadan import/export kodu yazılmaz (`docs/05` R2 kapısı).

| No | Adım | Çıktı |
| --- | --- | --- |
| KE-1 | Kullanıcıdan şablon dosyasını al; `templates/weekly-plan-template.xlsx` olarak **salt-okunur** kopyala | dosya + SHA-256 |
| KE-2 | Sayfa envanteri: sayfa adları, görünürlük, kullanılan aralık (`UsedRange`), birleşik aralık sayısı | manifest `sayfalar[]` |
| KE-3 | Eksen tespiti: gün etiketleri hangi satır/kolonda, plaka başlıkları hangi bantta — mantıksal isim → fiziksel adres | `fields.json` `hucreler{}` |
| KE-4 | İsimli aralık (`NamedRange`) envanteri; varsa bunlar tercih edilir | manifest `isimli_araliklar[]` |
| KE-5 | Formül envanteri: günlük sayım ve toplam hücreleri (`HasFormula` + formül metni) | manifest `formuller[]` |
| KE-6 | İleri özellik envanteri: pivot, slicer, `.xlsm`, veri doğrulama, koşullu biçim sayısı | manifest `ozellikler{}` → `docs/02` D1 kararı |
| KE-7 | `PrintArea`, `PageSetup` (yön, ölçek, yinelenen başlık satırı), sütun genişlikleri | manifest `yazdirma{}` |

**Kullanıcıya sorulacak 3 madde (KE görüşmesi):**

| # | Soru | Neden gerekli |
| --- | --- | --- |
| S1 | Haftalık dosyada **hangi sayfa** esas alınacak: matris (Tip A), rotasyon (Tip B) yoksa ikisi de mi? İkisi çelişirse hangisi doğru kabul edilsin? | `docs/01` §9/9 — **O2 (2026-10-27) ile cevaplandı:** esas kaynak Tip B, Tip A çapraz doğrulama. KE görüşmesinde yalnızca sayfa adları teyit edilir. |
| S2 | Şablonda **korunması zorunlu** ileri özellik var mı (pivot, slicer, makro, veri doğrulama listesi, koşullu biçim)? | ClosedXML kaybı riski (`docs/02` D1); gerekirse OpenXml'e düşülür |
| S3 | Günlük araç sayısı ve hafta toplamı **formül olarak mı** kalacak, yoksa uygulama hesaplayıp **değer** mi yazacak? | ADR-011 "kod yeni formül yazmaz" ile çelişki riski |

### 2.6 Şablon yoksa / farklıysa

| Durum | Davranış |
| --- | --- |
| `templates/weekly-plan-template.xlsx` yok | Import çalışır (okuma şablon gerektirmez); export **kilitlenir**, Türkçe mesaj: "Şablon dosyası bulunamadı. Excel sekmesinden şablon seçin." |
| Kullanıcı farklı bir dosya seçti | Keşif sihirbazı çalışır (KE-2…KE-7); manifest üretilmeden export yok |
| Manifest var, dosya hash'i farklı | Yeni sürüm sayılır → §6.3 |

### 2.7 Görsellerden (G01–G21) Okunan Gerçek Hücre Eşlemesi ve Şablon v2.0 Yerleşimi (2026-11-01, K1/D1 Kararı)

`proje resimleri/` altındaki 21 gerçek plan fotoğrafı (`G01`–`G21`) doğrudan incelenmiş, `docs/01` §3–§4 ve `docs/03` §3–§5 kurallarıyla çaprazlanmış ve koordinatör onayıyla (**GÖRSEL ESAS ALINIR**, `SABLON_SURUM = "2.0"`) `TemplateLayout` / `TemplateGenerator` / `templates/default-template.xlsx` yeniden üretilmiştir.

> **Önemli görsel tespit:** `docs/01` §2'deki erken analizde fotoğraflar `-90°` döndürülerek okunduğu için Tip A'da "satır = gün, kolon = plaka" yazılmıştır; ancak basılı `MATRIS` kâğıtlarında (`G02, G03, G05, G08, G10, G13, G14, G16, G21`) **satırlar plaka, kolonlar gündür** (`SIRA | PLAKALAR | PAZARTESİ … PAZAR | NÖBET`). Basılı `ROTASYON` kâğıtlarında (`G01, G04, G06, G07, G09, G11, G12, G15, G17–G20`) ise **kolonlar 7 gün, satırlar üst hafta başlığı + gün başlığı + kolon üstü görev grubu/hat notu + sıralı plaka listesi + `YAT` bloğudur**.

#### 2.7.1 `MATRIS` Sayfası Hücre Eşlemesi (Tip A — G02, G03, G05, G08, G10, G13, G14, G16, G21)

| Bölge / Alan | Görseldeki (`G02..G21`) gerçek yerleşim | `TemplateLayout` (v2.0) Excel adresi | `TemplateLayout` sabiti | Karar / Açıklama |
| --- | --- | --- | --- | --- |
| **Üst günlük özet bandı** | Tablo başlığının üstünde, gün kolonları hizasında **2 dar satır** (günlük hat/sefer özet sayıları; ör. `2 26 27 21` / `18 4 3 1 6`); sol üst köşede sayfa/hafta no (`81`..`86`) | `A1:J2` (Satır `1` ve Satır `2`) | `MatrixTopSummaryRow1 = 1`, `MatrixTopSummaryRow2 = 2` | Görselden birebir alındı; başlık satırı 3. satıra kaydırıldı |
| **Ana tablo başlık satırı** | `SIRA` \| `PLAKALAR` \| `PAZARTESİ` … `PAZAR` \| `NÖBET` \| `HAFTA ARALIĞI` | Satır `3` (`A3:N3`) | `MatrixHeaderRow = 3` | Görseldeki 2 üst özet satırının hemen altı |
| **Sıra no kolonu (`SIRA`)** | `PLAKALAR` bloğunun sol alt sütunu (`1..45` sıra numarası) | Kolon `A` (`A4:A48`, başlık `A3` = `"SIRA"`) | `MatrixSequenceColumn = 1` | Görselde plaka solundaki sıra numarası kolonu |
| **Plaka kolonu (`PLAKALAR`)** | 3 haneli filo plaka kodları (`003..286`), 45 plaka (O5 kararı; `134, 186, 225, 229` hücre yorumlu) | Kolon `B` (`B4:B48`, başlık `B3` = `"PLAKALAR"`) | `MatrixPlateColumn = 2`, `MatrixFirstPlateRow = 4`, `MatrixLastPlateRow = 48` | O5 kararıyla 45 plaka korunur (`FiloSeeder.AllPlates`) |
| **7 gün kolonu (`PAZARTESİ`..`PAZAR`)** | Soldan sağa `PAZARTESİ, SALI, ÇARŞAMBA, PERŞEMBE, CUMA, CUMARTESİ, PAZAR` | Kolon `C..I` (`C3:I3` başlık, `C4:I48` görev kodları) | `MatrixFirstDayColumn = 3` (`C`), `MatrixLastDayColumn = 9` (`I`) | Görev kodu hücreleri (`7A`, `9AT`, `6`, `-20` vb.) |
| **`NÖBET` kolonu** | `PAZAR` kolonunun hemen sağındaki kolon; araç başına nöbet günündeki hat kodu (`2, 4, 5, 6, 20`) | Kolon `J` (`J3` = `"NÖBET"`, `J4:J48` nöbet hat kodu) | `MatrixStandbyColumn = 10` (`J`) | `Nobet.nobet_kodu` (`kaynak_tablo = 'matris'`) |
| **Günlük araç sayısı ve Hafta toplamı satırı** | Son plaka satırının hemen altındaki toplam satırı (`8, 4, 8, 8, 8, 20, 20` ve `= 76` / `= 101`) | Satır `49`: `B49` = `"GÜNLÜK ARAÇ SAYISI"`, `C49:I49` = `COUNTA(C4:C48)`..`COUNTA(I4:I48)`, `J49` = `COUNTA(J4:J48)`, `K49` = `"HAFTA TOPLAMI"`, `L49` = `SUM(C49:I49)` | `MatrixCountRow = 49`, `MatrixWeekTotalLabelColumn = 11` (`K`), `MatrixWeekTotalColumn = 12` (`L`) | Günlük sayım ve hafta toplamı formülleri (`COUNTA` + `SUM`) |
| **Hafta başlığı (tarih aralığı) alanı** | Görselde sağ kenar boşluğunda (`G03, G05, G08, G14, G21`) hafta tarih aralığı (`dd.MM.yyyy – dd.MM.yyyy`) | `K3` = `"HAFTA ARALIĞI"`, `L3:N3` birleşik (`HAFTA_ARALIGI` adlandırılmış aralığı) | `MatrixWeekRangeLabelColumn = 11` (`K`), `MatrixWeekRangeColumn = 12` (`L`), `MatrixLastColumn = 14` (`N`) | Sağ üst bilgi alanında birleşik hücre ve `HAFTA_ARALIGI` |
| **Şablon sürüm hücresi (`SABLON_SURUM`)** | Uygulama içi şablon sürüm doğrulaması | Gizli Kolon `P`, `P3` = `"2.0"` (`SABLON_SURUM`) | `MatrixVersionColumn = 16` (`P`), `TemplateVersion = "2.0"` | K1/D1 yerleşim geçişiyle sürüm `"2.0"` yapıldı |
| **Yazdırma alanı (`PrintArea`)** | A4 yatay, tek sayfaya sığdırılmış (`FitToPages(1, 1)`) | `A1:N49` | `MatrixPrintArea = "A1:N49"` | Başlık satırı (`3`) üstte tekrarlanır |

#### 2.7.2 `ROTASYON` Sayfası Hücre Eşlemesi (Tip B — G01, G04, G06, G07, G09, G11, G12, G15, G17–G20)

| Bölge / Alan | Görseldeki (`G01..G20`) gerçek yerleşim | `TemplateLayout` (v2.0) Excel adresi | `TemplateLayout` sabiti | Karar / Açıklama |
| --- | --- | --- | --- | --- |
| **Üst hafta tarih başlığı** | Tablo çerçevesinin en üstünde ortalanmış `/ 26.10.2026 – 01.11.2026 /` tarih aralığı | Satır `1`: `A1` = `"HAFTA ARALIĞI"`, `B1:H1` birleşik hafta tarih aralığı | `RotationTitleRow = 1` | Görseldeki üst hafta tarih bandı; export sırasında doldurulur |
| **Gün başlık satırı** | `SIRA` \| `PAZARTESİ` … `PAZAR` \| `YAT` | Satır `2`: `A2` = `"SIRA"`, `B2:H2` = 7 gün adı, `I2` = `"YAT"` | `RotationHeaderRow = 2`, `RotationSequenceColumn = 1` (`A`), `RotationFirstDayColumn = 2` (`B`), `RotationLastDayColumn = 8` (`H`), `RotationSeparatorColumn = 9` (`I`) | Gün ekseni başlık satırı |
| **Kolon üstü görev grubu / ana hat not satırı (`ROT_GRUP_NOT`)** | Gün başlığının hemen altında **1 özel satır**: `2. Töre (6) Toki`, `2. Töre (2) F.Çelebi`, `2. Töre (5) B.Evler`, `2. Töre (1) Kampüs` veya `(4) (20)`, `(7A) (9)`, `(8) (10)` | Satır `3`: `A3` = `"GRUP / HAT"`, `B3:H3` = gün bazlı grup/hat notu hücreleri | `RotationGroupNoteRow = 3`, `RotationGroupNoteLabel = "GRUP / HAT"` | Görseldeki kolon üstü not satırı şablonda ayrıldı; import sırasında başlık bandı olarak atlanır |
| **Görevli plaka satırları ve `x` (nöbet) işaretleri** | Her gün kolonunda yukarıdan aşağıya görevli plakalar ve `x` nöbet işaretleri (O3) | Satır `4..48`: `A4:A48` = `1..45` sıra no, `B4:H48` = görevli plaka / `x` hücreleri | `RotationFirstDutyRow = 4`, `RotationLastDutyRow = 48` | 45 araçlık görev yuvası (`Atama.durum = Gorevli`, `sira_no = 1..45` veya `x` → `Nobet`) |
| **`YAT` ayırıcı satırı** | Görevli araç listesi ile yatan araç listesini ayıran `YAT` satırı | Satır `49`: `A49:H49` = `"YAT"` | `RotationRestingLabelRow = 49` | `YAT` bloğu başlangıç etiketi |
| **Yatan araç (`YAT`) bloğu** | O gün göreve çıkmayan (yatan) araçların plaka listesi | Satır `50..94`: `A50:A94` = `1..45` sıra no, `B50:H94` = yatan plaka hücreleri | `RotationFirstRestingRow = 50`, `RotationLastRestingRow = 94` | `Atama.durum = Yat` |
| **Yazdırma alanı (`PrintArea`)** | A4 yatay, tek sayfaya sığdırılmış (`FitToPages(1, 1)`) | `A1:I94` | `RotationPrintArea = "A1:I94"` | Tüm rotasyon + YAT bloğunu kapsar |

#### 2.7.3 Görselde Olup Şema Değişikliği Gerektirdiği İçin Kapsam Dışı / v2 Bırakılan Ayrıntılar

Koordinatör kararı (2026-11-01, K1/D1 kural 6: *"Şemaya DOKUNMA; ROTASYON'u mevcut modelin karşıladığı ölçüde üret ve karşılanmayan görsel detayı `docs/04-excel-io.md`'de 'kapsam dışı / v2' olarak not düş"*) uyarınca aşağıdaki görsel ayrıntılar v1 şemasında tutulmadığından **kapsam dışı / v2** olarak belgelenmiştir:

| # | Görseldeki (`G01..G21`) detay | Neden v1'de doğrudan üretilmiyor (şema/model sınırı) | v1 (Şablon v2.0) davranışı | Hedef sürüm |
| --- | --- | --- | --- | --- |
| 1 | `ROTASYON` sayfasında her günün **2 alt kolona** (sol/sağ plaka sütunu, 7×2 = 14 kolon) bölünmesi | `Atama.sira_no` tek boyutlu (`1..45`) tutulur; alt kolon (`sol`/`sağ`) alanı Domain/EF şemasında yoktur | Her gün tek kolon (`B..H`) ve `4..48` satır aralığında (`1..45`) temsil edilir | **kapsam dışı / v2** |
| 2 | `ROTASYON` hücresinde `× 146` gibi nöbet işareti ve plakanın **aynı hücre içinde** yazılması | O3 kararı ve `HucreKoduCozucu` tasarımında `x` tek başına nöbet işareti hücresidir (`StandbyMarker`), plaka ile birleşik hücre metni (`× 146`) ayrı şema alanı gerektirir | `ROTASYON`da `x` nöbet işareti olarak okunur; plaka bazlı nöbet hat kodu `MATRIS` `NÖBET` (`J`) kolonundan okunur/yazılır | **kapsam dışı / v2** |
| 3 | `ROTASYON` 3. satırındaki (`ROT_GRUP_NOT`) `2. Töre (6) Toki` / `(7A) (9)` metinlerinin export sırasında otomatik doldurulması | `Gun` (`PlanningDay`) tablosunda `ana_hat_kodu` veya güne bağlı görev grubu başlık metni alanı yoktur | Şablonda 3. satır (`GRUP / HAT`, `B3:H3`) fiziksel olarak ayrılmıştır; export sırasında boş bırakılır, import sırasında başlık bandı olarak güvenle atlanır | **kapsam dışı / v2** |
| 4 | `ROTASYON`da `YAT` ayırıcı satırının her gün kolonunda görevli araç sayısına göre **farklı satırda** başlaması | Sabit şablon (`TemplateLayout`) mimarisinde `YAT` bloğu tüm günler için tek bir sabit satır (`49. satır`) altında hizalanır | `49. satır` sabit `YAT` ayırıcısı, `50..94. satırlar` yatan araç bloğudur | **kapsam dışı / v2** |
| 5 | `MATRIS` üst özet bandındaki (`A1:J2`) günlük hat/sefer özet sayılarının (`2 26 27 21` / `18 4 3 1 6`) otomatik hesaplanması | Bu sayıların hangi hat/sefer kombinasyonundan türetildiği `docs/01` §9'da açık varsayımdır ve şemada karşılığı yoktur | `A1:J2` bandı görsel yerleşime uygun olarak şablonda ayrılmıştır; hücreleri boş bırakılır (varsayım) | **kapsam dışı / v2 (VARSAYIM)** |

---

## 3) İçe aktarma (import) tasarımı

### 3.1 Akış

| Adım | İşlem | Kural / hata kodu |
| --- | --- | --- |
| I1 | Dosya doğrulama: uzantı `.xlsx`, boyut ≤ 20 MB, kilitli değil, zip bütünlüğü | `E-IMP-001`, `E-IMP-002` |
| I2 | Salt-okunur aç: `new XLWorkbook(path, XLEventTracking.Disabled)`; orijinal dosyaya yazma yok | — |
| I3 | Sayfa tipi tespiti (§3.2); iki sayfa varsa **önce Tip B** okunur (O2) | `E-IMP-010` (belirsiz), `W-IMP-011` (düşük güven) |
| I4 | Hafta tarih aralığını oku (`dd.MM.yyyy – dd.MM.yyyy`), `Hafta` + 7 `Gun` üret | `W-IMP-012` (aralık 7 gün değil) |
| I5 | Eksenleri bul: gün etiketleri, plaka başlıkları / plaka satırları | `E-IMP-020` (eksen yok) |
| I6 | Hücreleri oku: `UsedRange` içinde gezin, birleşikleri çöz, boşları atla | `W-IMP-031` |
| I7 | Kodu normalize et (§3.3) ve `Atama`/`Nobet`/`GorevGrubu` üret | `W-IMP-021`, `W-IMP-022` |
| I8 | Sözlükleri upsert et: `Arac` (plaka), `Hat` (hat_kodu), `GorevGrubu` | `W-IMP-041` (bilinmeyen plaka) |
| I9 | Doğrula + rapor: günlük sayı ve toplam karşılaştırması, çakışma kontrolü | `W-IMP-050`, `W-IMP-051` |

Tek `Transaction` içinde yazılır: ya haftanın tamamı yazılır ya hiçbiri (kısmi import yok). Kullanıcı "hataları yok say ve devam et" derse `Atama.durum = belirsiz` + `elle_duzeltme = true` ile yazılır.

### 3.2 Sayfa tipi tespit kuralları (puanlama)

| Test | Puan | Açıklama |
| --- | --- | --- |
| Bir satırda 5+ gün adı (`PAZARTESİ…PAZAR`) bulundu | Tip B +3 | Günler kolon başlığı |
| Bir kolonda 5+ gün adı bulundu | Tip A +3 | Günler satır etiketi |
| `YAT` etiketi bulundu | Tip B +2 | `docs/01` §2 |
| `NÖBET` etiketi bulundu | Tip A +2 | Nöbet satırı |
| `PLÂKALAR` etiketi bulundu | Tip A +2 | Alt eksen etiketi |
| Bir bantta 10+ plaka-benzeri 3 haneli sayı, dikey blok | Tip B +2 | Plaka listesi |
| Bir bantta 10+ plaka-benzeri sayı, yatay başlık | Tip A +2 | Plaka kolonları |
| Sayfada `=TOPLA`/`=SUM` veya `=76` toplam hücresi | Tip A +1 | Sağ üst toplam |
| Sayfa adı `MATRİS`/`PLAN` içeriyor | Tip A +1 | Sezgisel |
| Sayfa adı `ROTASYON`/`GÜN` içeriyor | Tip B +1 | Sezgisel |

Karar: `fark ≥ 2` → tip kesin. `fark < 2` → `E-IMP-010` (kullanıcıya "Bu sayfa hangi tipe ait?" sorusu; iki seçenek sunulur). Tek dosyada iki sayfa varsa her sayfa ayrı sınıflandırılır; ikisi de aynı haftayı gösteriyorsa **Tip B esas** (O2), Tip A yalnızca çapraz doğrulama ve eksik hücre tamamlama için kullanılır (V-08).

### 3.3 Hücre kodu → model dönüşümü

Normalizasyon sırası: `Trim` → `U+00A0` ve görünmez karakter temizliği → `ToUpperInvariant` (Türkçe `İ/ı` eşlemesi ayrı sözlükle) → sayısal metin ise `int`/`decimal` denemesi → desen eşleme.

| Kod / desen | Örnek | Model alanı | Dönüşüm | Belirsizlik |
| --- | --- | --- | --- | --- |
| `A`, `S` | `A` | `Atama.vardiya` | A→`A`, S→`S` | `S` "servis dışı" da olabilir (`docs/01` §3) |
| `A1`, `1A` | `A1` | `vardiya=A`, `sira_no=1` | Rakam + harf ayrıştırılır | `1A` hat kodu olabilir (`docs/01` §9/3); `sefer_sayisi` hücreden türetilmez (O1) |
| `7A`, `8A`, `10A`, `12A` | `7A` | `Hat.hat_kodu`, `hat_no=7`, `varyant=A` | Regex `^(\d{1,2})([A-Z])$` | 7. bölge + vardiya olabilir |
| `9A` | `9A` | `hat_kodu=9A` | Aynı regex | — |
| `9AT`, `9S`, `7A(S)` | `9AT` | `hat_kodu=9AT`, `varyant=T` | Ek harf `varyant`a yazılır; parantez içi atılır | `T` = Töre/tam gün/takviye (`docs/01` §9/2) |
| `26A`, `27B`, `26E` | `26B` | `hat_no=26`, `varyant=B` | Aynı regex | Görev grubu sırası olabilir |
| Tek rakam `2`,`5`,`6`,`7` … | `6` | `Hat.hat_no=6`, `Atama.hat_no=6` (sözlükte varsa `hat_id`) | `int` | **ONAYLANDI (2026-10-27, O1):** hat numarası; sefer sayısı değil |
| Çift hane `10…30` | `20` | `Hat.hat_no=20` | `int` | O1 sonrası sayı = hat numarası (belirsizlik kapandı) |
| `100`, `105`, `108` | `108` | `hat_no=108` | `int` (3 hane) | Sefer no olabilir |
| `-20`, `-13`, `-108` | `-20` | `hat_no=20`, `ek_gorev=true` | Eksi işareti `ek_gorev` bayrağına | Saat (20:00) olabilir (`docs/01` §9/14) |
| `0-20`, `D-20`, `D` | `D-20` | `hat_no=20`, `not="D"` | Ön ek `not` alanına | `D` = devam/devir (`docs/01` §9/14) |
| `5x`, `6x`, `2x` | `5x` | `Atama.hat_no=5` + `Nobet` kaydı | Sayı = hat no (O1); `x` = nöbet işareti (O3) | Birleşik anlam hâlâ varsayım → `varsayim_mi=1` |
| `x`, `X` | `x` | `Nobet.tip=NobetIsareti`, `Nobet.kaynak=Hucre`, `Nobet.kaynak_tablo='rotasyon'`, `Nobet.nobet_gunu=gun_id` | Sabit; `Atama` üretilmez | **ONAYLANDI (2026-10-27, O3 + H4):** `x` = o plakanın nöbet günü (41/41 eşleşme); iptal değil |
| `12.00`, `13.00`, `20.30` | `12.00` | `Sefer.baslangic_saat` | `TimeOnly(12,00)`; hücre `TimeSpan` ise doğrudan | Saat mi sefer no mu (`docs/01` §9/15) |
| `12G`, `12P` | `12P` | `hat_no=12`, `not="P"` | Sonek `not` | Gündüz/pik (`docs/01` §9/17) |
| `(7A)` | `(7A)` | `Gun.ana_hat_kodu` | Parantez soyulur | Günün ana hattı (`docs/01` §9/16) |
| `(12)`, `(6)` | `(12)` | `Atama.sira_no` (Tip B) / `GorevGrubu.arac_sayisi` (kolon üstü) | Konuma göre iki anlam | Bağlam yoksa `W-IMP-022` |
| `YAT` | `YAT` | `Atama.durum=YAT` | Sabit | Yatan araç kuralı (`docs/01` §9/11) |
| `NÖBET` satırı değeri | `5` | `Nobet.nobet_kodu` (`TEXT`) → `hat` sözlüğüne çözülür (`hat_id`), `Nobet.kaynak_tablo='matris'` | Metin olduğu gibi okunur; kod → hat eşlemesi zorunlu | **ONAYLANDI (2026-10-27, H4 + kullanıcı teyidi):** değer nöbet günündeki **hat kodu**dur (33/33 eşleşme); çözülemeyen kod **hata** `E-IMP-033` (uyarı değil) |
| Serbest not | `otogar` | `Atama.not` | Metin olduğu gibi | Sürücü/durak/bölge (`docs/01` §9/13) |
| Boş | — | — | `Atama` üretilmez | Silinmiş görev sayılmaz |

### 3.4 Bilinmeyen kod davranışı

| Durum | Sınıf | Davranış | Kullanıcı mesajı (Türkçe) |
| --- | --- | --- | --- |
| Desen hiçbir kuralla eşleşmiyor | Uyarı `W-IMP-021` | Hücre `Atama.not = "<ham metin>"`, `durum = belirsiz` olarak yazılır; import devam eder | "PLAN!<hücre>: '<değer>' kodu tanınmadı. Ham değer korundu, düzeltin." |
| Kod tanınıyor ama anlamı çift (tek rakam) | Bilgi (eski `W-IMP-022`) | Tek rakam **hat numarası** olarak yazılır (`Hat.hat_no`/`Atama.hat_no`, O1); `sefer_sayisi` doldurulmaz | "PLAN!<hücre>: '6' hat numarası olarak yorumlandı." |
| Plaka filoda yok | Uyarı `W-IMP-041` | `Arac` oluşturulur (`aktif = false`) | "PLAN!<hücre>: '221' plakası filoda yok, pasif araç olarak eklendi." |
| Eksen bulunamadı (gün/plaka bandı yok) | **Hata** `E-IMP-020` | Import iptal, hiçbir kayıt yazılmaz | "Sayfada gün/plaka ekseni bulunamadı. Şablon keşfi gerekli." |
| `NÖBET` kodu `Hat` sözlüğünde yok | **Hata** `E-IMP-033` | Import iptal, hiçbir kayıt yazılmaz (uyarı değil) | "PLAN!<hücre>: '<kod>' nöbet kodu hat sözlüğünde yok. Hattı tanımlayıp yeniden aktarın." |
| Sayfa tipi belirsiz | **Hata** `E-IMP-010` | Kullanıcı seçim yapana kadar durur | "Sayfa tipi belirlenemedi: matris mi, rotasyon mu?" |
| Dosya açılamıyor/bozuk | **Hata** `E-IMP-001` | İptal | "Dosya açılamadı. Excel'de açıp yeniden kaydedin." |
| Hafta tarih aralığı 7 gün değil | Uyarı `W-IMP-012` | Onay istenir | "Başlıktaki tarih aralığı 7 gün değil (04.09.2026?). Devam edilsin mi?" |

Politika: **yapısal hata → dur, anlamsal belirsizlik → uyarı + devam.** Sessiz yutma yok; her uyarı raporda satır/hücre ile listelenir.

### 3.5 Türkçe karakter ve kodlama

| Konu | Kural |
| --- | --- |
| Kodlama | `.xlsx` içeriği UTF-8 XML'dir; ayrı encoding ayarı yok. CSV/JSON için UTF-8 (BOM'suz) — `docs/02` R5 |
| Gün adı eşleme | `PAZARTESİ, SALI, ÇARŞAMBA, PERŞEMBE, CUMA, CUMARTESİ, PAZAR`; `tr-TR` sözlüğü ile `ToUpper` (noktalı/noktasız i ayrımı korunur) |
| `İ` / `I` / `ı` / `i` | Karşılaştırma `StringComparer.InvariantCultureIgnoreCase` **değil**, normalize edilmiş sözlük anahtarı ile yapılır (`İSTASYON` ≠ `ISTASYON` hatası önlenir) |
| `â` (PLÂKALAR) | Etiket sözlüğünde hem `PLAKALAR` hem `PLÂKALAR` anahtarı var |
| Boşluk / görünmez karakter | `U+00A0`, `U+200B`, `\t`, `\r`, `\n` temizlenir |
| Türkçe metin assert'i | Golden testte `"Şube"`, `"İstasyon"`, `"Görev"`, `"Çarşamba"` (`docs/02` §7.3 adım 5) |
| Sayı biçimli metin | `"030"` metin hücresi ise **metin** okunur; `030` sayı ise `30` olur → plaka baştaki sıfır kaybı `E-IMP-032` |

### 3.6 Boş, birleşik ve kaymış hücreler

| Durum | Kural |
| --- | --- |
| Boş hücre | `Atama` üretilmez; "o araç o gün görevsiz" anlamına gelir (Tip A) |
| Yalnızca boşluk içeren hücre | Boş sayılır |
| Birleşik aralık | Değer sol-üstten; kapsanan hücreler tekrar okunmaz (`W-IMP-031` uyarısı) |
| Kaymış satır (elle eklenen satır) | Eksen `PLAN_PLAKA_BASLIK` üzerinden yeniden bulunur; sabit satır numarası yok |
| Başlık bandı 1–4 satır | `PLAN_GUN_ETIKET` ilk eşleşen gün adı satırıdır |
| Yinelenen plaka kolonu | `W-IMP-042`; ilk kolon esas, ikincisi yok sayılır |
| Sayfada gizli satır/kolon | Okunur (gizli veri kaybı olmasın), uyarı `W-IMP-043` |

---

## 4) Hücre → model eşleme tablosu

> Konumlar mantıksaldır. Fiziksel adres `templates/fields.json` içinde `KE-3` sonrası doldurulur. `PLAN` = Tip A sayfası, `ROT` = Tip B sayfası (sayfa adları keşifte kesinleşir).

| # | Excel konumu / deseni | Örnek değer | Model alanı | Dönüşüm kuralı | Belirsizlik notu |
| --- | --- | --- | --- | --- | --- |
| 1 | `PLAN_HAFTA_BASLIK` (birleşik bant) | `26.10.2026 – 01.11.2026` | `Hafta.baslangic`, `Hafta.bitis` | İki `DateOnly`; ayraç `–`, `-`, `—` | Yazım hatası olabilir (`docs/01` G12) |
| 2 | `PLAN_GUN_ETIKET` (sol kolon) | `PAZARTESİ` | `Gun.gun_adi` | `tr-TR` sözlük; sıra Pzt→Paz | Tabloda Pazar en üstte (ters sıra) |
| 3 | `PLAN_GUN_ETIKET` → `Gun.tarih` | `PAZARTESİ` + hafta başı | `Gun.tarih` | `baslangic + (gun_adi sırası)` | Hafta başı Pzt varsayımı **V-05** |
| 4 | `PLAN_PLAKA_BASLIK` (kolon başlığı) | `003` | `Arac.filo_no`, `Arac.plaka` | 3 hane metin; `plaka = "43" + kod` | `221/229`, `085/225` çelişkisi (`docs/01` §9/6–7) |
| 5 | `PLAN_PLAKA_ALT_SATIR` (1…41) | `17` | `Arac.filo_no` doğrulaması | Sıra no = basılı kolon sırası | Sıra no model alanı değil, kontrol amaçlı |
| 6 | `PLAN_HUCRE_BLOK` — harf | `A` | `Atama.vardiya` | `A`/`S` sabit sözlük | `S` = servis dışı olabilir |
| 7 | `PLAN_HUCRE_BLOK` — `A1` | `A1` | `vardiya=A`, `sira_no=1` | Harf+rakam ayrıştırma | `1A` ile aynı mı (`docs/01` §9/3); `sefer_sayisi` türetilmez (O1) |
| 8 | `PLAN_HUCRE_BLOK` — `7A` | `7A` | `Hat.hat_kodu=7A` | Regex `^(\d{1,2})([A-Z])$` | Hat mı, bölge+vardiya mı |
| 9 | `PLAN_HUCRE_BLOK` — `9AT` | `9AT` | `hat_kodu=9AT`, `varyant=T` | Sonek harf `varyant` | `T` anlamı açık değil (`docs/01` §9/2) |
| 10 | `PLAN_HUCRE_BLOK` — `9S` / `7A(S)` | `7A(S)` | `hat_kodu=7A`, `vardiya=S` | Parantez içi `vardiya` | Sonek mi vardiya mı |
| 11 | `PLAN_HUCRE_BLOK` / `ROT_PLAKA_SATIR` — tek rakam | `6` | `Hat.hat_no=6`, `Atama.hat_no=6` (sözlükte varsa `hat_id`) | `int`; **hat numarası** | **ONAYLANDI (O1):** sefer sayısı değil; `sefer_sayisi` hücreden türetilmez |
| 12 | `PLAN_HUCRE_BLOK` — çift hane | `20` | `Hat.hat_no=20` | `int` | O1 sonrası sayı = hat numarası (belirsizlik kapandı) |
| 13 | `PLAN_HUCRE_BLOK` — 3 hane | `108` | `Hat.hat_no=108` | `int` | Sefer no olabilir |
| 14 | `PLAN_HUCRE_BLOK` — eksi | `-20` | `hat_no=20`, `ek_gorev=true` | Baştaki `-` bayrağa | Saat 20:00 olabilir (`docs/01` §9/14) |
| 15 | `PLAN_HUCRE_BLOK` — `D` ön ekli | `D-20` | `hat_no=20`, `not="D"` | Ön ek `not` | `D` = devam/devir |
| 16 | `PLAN_HUCRE_BLOK` — `x` sonekli | `5x` | `Atama.hat_no=5` + `Nobet` kaydı | Sayı → hat no (O1); `x` → nöbet işareti (O3) | Birleşik anlam varsayım → `varsayim_mi=1` |
| 17 | `PLAN_HUCRE_BLOK` / `ROT_PLAKA_SATIR` — `x` | `x` | `nobet(nobet_gunu=gun_id, kaynak_tablo='rotasyon')`, `Nobet.tip=NobetIsareti`, `Nobet.kaynak=Hucre` | Sabit; `Atama` üretilmez | **ONAYLANDI (O3 + H4):** `x` = nöbet günü (varlık 41/41); iptal değil |
| 18 | `PLAN_HUCRE_BLOK` — saat | `20.30` | `Sefer.baslangic_saat` | `TimeOnly(20,30)` | Sefer başı mı, vardiya sonu mu (`docs/01` §9/15) |
| 19 | `PLAN_NOBET_SATIRI` etiketi | `NÖBET` | `Nobet.tip = gece` | Sabit sözlük | — |
| 20 | `PLAN_NOBET_SATIRI` hücresi | `5` | `Nobet.nobet_kodu` (`TEXT`) → `Hat` sözlüğü (`hat_id`), `Nobet.kaynak_tablo='matris'` | Metin olduğu gibi (`int`'e çevrilmez); kod → hat eşlemesi zorunlu, çözülemeyen kod `E-IMP-033` (import hatası) | **ONAYLANDI (2026-10-27, H4 + kullanıcı teyidi):** değer nöbet günündeki **hat kodu**dur |
| 21 | `PLAN_GUNLUK_SAYI` (sağ kolon) | `8` | `Gun.gorevli_arac_sayisi` (hesaplanan) | Formül varsa okunmaz; yoksa `int` okunur ve doğrulamada kullanılır | "Araç sayısı" mı "görev sayısı" mı (`docs/01` §9/4) |
| 22 | `PLAN_HAFTA_TOPLAM` (sağ üst) | `=76` | `Hafta.toplam_arac_gun` (doğrulama) | Formül metni saklanır; hesaplanan değer `CachedValue` | ClosedXML hesaplamaz → önbellek değeri bayat olabilir |
| 23 | `PLAN_SOL_NOT` (sol kenar) | `10 / 4-15` | — (v1 kapsam dışı) | Okunmaz | Günlük sefer/saat aralığı hipotezi; `W-IMP-060` |
| 24 | `ROT_HAFTA_BASLIK` | `26.10.2026 – 01.11.2026` | `Hafta` (Tip A ile aynı) | Aynı parser; çelişirse `W-IMP-013` | Tip A ile tarih uyuşmazlığı |
| 25 | `ROT_GUN_BASLIK` (kolon başlığı) | `ÇARŞAMBA` | `Gun.gun_adi` | `tr-TR` sözlük | — |
| 26 | `ROT_PLAKA_SATIR` (gövde) | `188` | `Atama.arac_id`, `Atama.sira_no` | Satır sırası `sira_no` | Sıra no mu, sefer no mu (`docs/01` §9/16) |
| 27 | `ROT_YAT_ISARET` | `YAT` | `Atama.durum=YAT` | Sabit; altındaki tüm plakalar `YAT` | Yatan kuralı (`docs/01` §9/11) |
| 28 | `ROT_GRUP_NOTU` | `2. Töre (6) Toki` | `GorevGrubu.ad`, `arac_sayisi` | Parantez içi `arac_sayisi`; kalan metin `ad` | `2. Töre` nedir (`docs/01` §9/12) |
| 29 | `ROT_GUN_ANA_HAT` (daireli çift) | `(7A)` | `Gun.ana_hat_kodu` | Parantez soyulur | Çift mi vardiya mı (`docs/01` §9/16) |
| 30 | `ROT_SIRA_DIZISI` (kolon altı) | `(12)` | `Atama.sira_no` | Parantez soyulur, `int` | Rotasyon sırası mı sefer no mu |
| 31 | `ROT_SERBEST_NOT` | `otogar` | `Atama.not` | Metin olduğu gibi | Sürücü/durak/bölge (`docs/01` §9/13) |
| 32 | Üstü çizik plaka (`×253`) | `×253` | `Arac.aktif=false`, `Duzeltme.tur=ustu_cizme` | `×` ön eki → üstü çizik + düzeltme kaydı; hücredeki tek `x` bu desen **değildir** (O3) | Kalıcı filo değişimi mi, haftalık mı |
| 33 | Fosforlu hücre (dolgu rengi) | pembe dolgu | `Atama.elle_duzeltme=true`, `Duzeltme.tur=fosforlu` | Renk kodu eşlemesi (keşif: hangi renk hangi anlam) | Renk anlamı doğrulanmadı (`docs/01` §7) |
| 34 | Kırmızı çapraz taranmış kolon/satır | tarama | `Atama.durum=iptal` (yalnızca elle; kolon ise `Arac.aktif=false`) | Görsel tespit v1'de **yok** → yalnızca elle işaretleme (O3: hücredeki `x` iptal sayılmaz) | Otomatik tespit kapsam dışı |
| 35 | Birleşik başlık hücresi | `HAFTALIK PLAN` | — | Atlanır | — |
| 36 | Boş hücre | (boş) | — | `Atama` üretilmez | "Görevsiz" mi "doldurulmadı" mı |

**Toplam: 36 satır** (≥ 20 koşulu karşılandı).

---

## 5) Dışa aktarma (export) tasarımı

### 5.1 Template-preserving akış (ClosedXML)

| Adım | İşlem | Kural |
| --- | --- | --- |
| E1 | **Validator** çalışır (§7.2) | `Error` varsa dosya yazılmaz |
| E2 | Şablon `File.Copy` ile geçici çalışma kopyasına alınır (`%TEMP%/kbplan-export-<guid>.xlsx`) | Şablon asla yerinde değişmez (`docs/02` §4.3 adım 1) |
| E3 | Kopya `new XLWorkbook(workCopy)` ile açılır | `XLEventTracking.Disabled` (performans) |
| E4 | Hedef sayfa + mantıksal hücre haritası `templates/fields.json`'dan çözülür | Hücre adresi koda gömülmez; eksikse `E-EXP-002` |
| E5 | Yalnızca **değer aralığı** temizlenir (`Clear(XLClearOptions.Contents)`), stil korunur | `InsertRow`/`InsertData` **yasak** (ADR-011) |
| E6 | Değerler tipiyle yazılır: kod → metin, saat → `TimeSpan`, tarih → `DateOnly`/`DateTime`, sayı → `int` | `docs/02` §4.4 |
| E7 | Formül hücrelerine dokunulmaz; `workbook.CalculateMode = XLCalculateMode.Auto` + `FullCalcOnLoad` | Kod yeni formül yazmaz (ADR-011) |
| E8 | `PrintArea` / `PageSetup` / sütun genişliği korunur; `AdjustToContents` çağrılmaz | `docs/02` §4.4 |
| E9 | Geçici dosyaya kaydet → hedef ada atomik taşı (`File.Move`) | Yarım dosya kalmaz |
| E10 | Kaydettikten sonra dosya yeniden açılır, assert edilir (§8.2) | `docs/02` §7.3 |
| E11 | Şablon hash'i yeniden hesaplanır, değişmediği doğrulanır | `E-EXP-011` |

### 5.2 Export hücre haritası

> Fiziksel adresler `fields.json` içinde; burada **mantıksal isim** ve dönüşüm kuralı tanımlıdır. `KE-3`/`KE-4` sonrası `adres` alanı dolar.

| # | Model alanı | Hedef mantıksal isim | Hedef tür | Dönüşüm | Not |
| --- | --- | --- | --- | --- | --- |
| 1 | `Hafta.baslangic` / `bitis` | `PLAN_HAFTA_BASLIK` | Metin (`dd.MM.yyyy – dd.MM.yyyy`) | Biçim `tr-TR` | Birleşik bant; yalnızca sol-üst hücre yazılır |
| 2 | `Hafta.bitis` (ISO) | `PLAN_DOSYA_ETIKET` | Metin (opsiyonel hücre) | `yyyy-MM-dd` | Şablonda yoksa atlanır |
| 3 | `Gun.gun_adi` | `PLAN_GUN_ETIKET[n]` (n=1…7) | Metin | Sabit Türkçe gün adı | Sıra Pzt→Paz; şablondaki sıra korunur |
| 4 | `Arac.filo_no` | `PLAN_PLAKA_BASLIK[m]` (m=1…45) | Metin (3 hane, baştaki sıfır) | `filo_no.ToString("000")` | Sayı biçimine düşerse sıfır kaybolur |
| 5 | `Atama.hat_kodu` / `Atama.hat_no` / `vardiya` | `PLAN_HUCRE_BLOK[gun, plaka]` | Metin | §3.3'ün tersi: kod yeniden üretilir (tek rakam = hat no, O1) | Hücre stili şablondan; `sefer_sayisi` hücreye yazılmaz (O1) |
| 6 | `Nobet.tip=NobetIsareti` (veya `Atama.durum=iptal`, yalnızca elle) | `PLAN_HUCRE_BLOK[...]` | Metin | Nöbet işareti → `"x"` (O3); elle iptal → üstü çizik gösterimi | Elle iptal gösterimi açık (§10.3) |
| 7 | `Nobet.nobet_kodu` (hat kodu) | `PLAN_NOBET_SATIRI[plaka]` | Metin | Kod olduğu gibi yazılır (`TEXT`, H4; `hat` sözlüğünde karşılığı zorunlu) | Nöbet yoksa boş |
| 8 | `Gun.gorevli_arac_sayisi` | `PLAN_GUNLUK_SAYI[gun]` | **Formül (dokunulmaz)** | — | Formül yoksa `W-EXP-021` |
| 9 | `Hafta.toplam_arac_gun` | `PLAN_HAFTA_TOPLAM` | **Formül (dokunulmaz)** | — | `=TOPLA(...)`/`=SUM(...)` |
| 10 | `Atama.sira_no` | `ROT_PLAKA_SATIR[gun, sira]` | Metin (plaka) | `plaka` metni | Liste uzunluğu değişirse satır aralığı taşar → §5.5 |
| 11 | `Atama.durum=YAT` | `ROT_YAT_BLOK[gun]` | Metin (plaka) | `YAT` etiketinden sonra yazılır | YAT yoksa etiket de yazılmaz |
| 12 | `GorevGrubu.ad` / `arac_sayisi` | `ROT_GRUP_NOTU[gun]` | Metin | `"{grup} ({sayi})"` | Elle yazılmış serbest metin; şablon formatı korunur |
| 13 | `Gun.ana_hat_kodu` | `ROT_GUN_ANA_HAT[gun]` | Metin | `"(" + kod + ")"` | Şablonda daireli biçim |
| 14 | `Atama.not` | `ROT_SERBEST_NOT[gun]` | Metin | Olduğu gibi, `max 200` karakter | Uzun not taşarsa `W-EXP-031` |
| 15 | `Duzeltme` listesi | `DEGISIKLIKLER` sayfası (varsa) | Tablo satırı | Tarih, plaka, eski→yeni | Şablonda sayfa yoksa yazılmaz |
| 16 | Uygulama sürümü | `META_SURUM` (isimli aralık) | Metin | `1.0.0` | Denetim izi |
| 17 | Export zamanı | `META_CIKTI_ZAMANI` | Metin (`dd.MM.yyyy HH:mm`) | `tr-TR` | Kullanıcı hangi çıktı olduğunu görsün |
| 18 | Şablon sürümü | `META_SABLON_SURUM` | Metin | manifest `sablon_surum` | §6 |

### 5.3 Kod → hücre metni (ters dönüşüm) kuralları

| Model durumu | Hücreye yazılan | Kural |
| --- | --- | --- |
| `vardiya=A`, sefer yok | `A` | Yalın vardiya |
| `vardiya=A`, `sira_no=1` | `A1` | `vardiya + sira_no` |
| `hat_kodu=9AT` | `9AT` | Kod aynen |
| `ek_gorev=true`, `hat_no=20` | `-20` | Eksi ön ek |
| `Nobet.tip=NobetIsareti` | `x` | O3: nöbet işareti hücresi |
| `durum=iptal` (yalnızca elle) | üstü çizik / `×` gösterimi | Hücreden iptal üretilmez (O3); gösterim açık (§10.3) |
| `durum=YAT` | (Tip A hücresi boş, Tip B `YAT` bloğu) | `YAT` yalnızca Tip B'de |
| `baslangic_saat=12:00` | `TimeSpan.FromHours(12)` | Sayı biçimi şablondan (`hh:mm`) |
| Boş atama | Hücre boş | `Clear(Contents)` sonrası yazılmaz |

### 5.4 Günlük sayım ve toplam formüllerinin korunması

| Konu | Kural |
| --- | --- |
| Formül hücresi tespiti | `cell.HasFormula` → yazma listesinden **çıkarılır** |
| Günlük sayım | Şablondaki formül (ör. `COUNTA`/`COUNTIF` aralığı) korunur; aralık hücre haritasından doğrulanır |
| Hafta toplamı | Şablondaki `=TOPLA(...)`/`=SUM(...)` korunur |
| Yeniden hesaplama | `workbook.CalculateMode = Auto`, `wb.ForceFullCalculation()` değil → Excel açılışta hesaplar (`FullCalcOnLoad`) |
| Formül yoksa | Kod formül **eklemez** (ADR-011); `W-EXP-021` uyarısı + kullanıcı seçeneği: "değer olarak yaz" (config `FormulYoksaDegerYaz=false` varsayılan) |
| Doğrulama | Export sonrası formül metni karşılaştırılır; değişmişse `E-EXP-012` |
| Önbellek değeri | `CachedValue` yalnızca raporda gösterilir, karar için kullanılmaz (bayat olabilir) |

### 5.5 Satır aralığı taşması (rotasyon listesi)

| Durum | Davranış |
| --- | --- |
| Gün kolonunda atama sayısı şablonun ayırdığı satırdan az | Kalan satırlar boş bırakılır; biçim korunur |
| Fazla | `InsertRow` **yasak** → `E-EXP-041`: "Rotasyon listesi şablonun ayırdığı alanı aşıyor (n/limit). Şablon güncellenmeli." |
| `YAT` bloğu taşması | Aynı hata; çözüm şablon revizyonu (§6) |

### 5.6 Koşullu biçimlendirme ve fosforlu renk politikası

| Konu | Politika |
| --- | --- |
| Şablondaki koşullu biçim kuralları | **Korunur**, kod müdahale etmez; export sonrası kural sayısı assert edilir (`docs/02` §7.3 adım 3) |
| Yeni koşullu biçim ekleme | v1'de yok |
| Fosforlu/elle vurgu (pembe, turuncu) | Anlamı **elle değişiklik** (`docs/01` §7) → `Duzeltme` kaydı olarak saklanır; hücre dolgusu **varsayılan olarak yazılmaz** |
| Vurgu yazma (opsiyonel) | Yalnızca şablonda `VURGU_DEGISIKLIK` adlı hücre stili varsa ve kullanıcı `--vurgula` seçtiyse uygulanır; yoksa sessizce atlanmaz, `W-EXP-051` |
| Renk anlamı eşlemesi | Keşifte netleşecek (kırmızı daire = özel görev, mavi/yeşil = vardiya hipotezi); v1'de renk **okunmaz** |
| Kırmızı çapraz tarama | v1'de otomatik tespit yok; kullanıcı iptali elle girer |

### 5.7 Yazdırma alanı ve sayfa kurulumu

| Ayar | Kaynak | Doğrulama |
| --- | --- | --- |
| `PrintArea` | Şablon | Export öncesi/sonrası eşitlik assert'i (`docs/02` §4.3 adım 5) |
| Yön (yatay/dikey), ölçek, kâğıt boyu | Şablon `PageSetup` | Assert |
| Yinelenen başlık satırları (`PrintTitles`) | Şablon | Assert |
| Sütun genişlikleri / satır yükseklikleri | Şablon | Assert (tolerans ±0.5) |
| `AdjustToContents` | **Çağrılmaz** | Kod incelemesi + test |
| Yazdırma önizleme | Uygulama içi önizleme v1'de yok; dosya Excel'de açılır (`docs/02` R4) | — |

### 5.8 Çıktı dosya adlandırma

| Kural | Değer |
| --- | --- |
| Ana desen | `plan_<baslangic>_<bitis>.xlsx` — ör. `plan_2026-10-26_2026-11-01.xlsx` |
| Tarih biçimi | `yyyy-MM-dd` (sıralanabilir, dosya sisteminde güvenli) |
| Klasör | `cikti/` (yapılandırılabilir, `docs/02` §6) |
| Üzerine yazma | **Yok**: varsa `plan_2026-10-26_2026-11-01-1.xlsx`, sonra `-2`… (maks. 99, sonra `E-EXP-061`) |
| Taslak/deneme çıktısı | `plan_2026-10-26_2026-11-01_taslak_<yyyyMMdd_HHmm>.xlsx` (`docs/02` §4.3 adım 7'deki zaman damgalı desen burada korunur) |
| Uzantı | Yalnızca `.xlsx` (`.xlsm` yazılmaz, §1.3 D3) |
| Kilit | Yazma sırasında `.lock` dosyası; uygulama çökerse sonraki açılışta temizlenir |

> Not: `docs/02` §4.3 adım 7 `HaftalikPlan_<yyyyMMdd_HHmm>.xlsx` diyordu. Bu doküman **kullanıcı isteğiyle** `plan_<baslangic>_<bitis>.xlsx` desenini v1 kuralı yapar; zaman damgalı desen yalnızca taslak çıktıda kalır. Mimari doküman değiştirilmedi, fark burada kayıtlıdır.

### 5.9 Üzerine yazma ve eşzamanlılık koruması

| Risk | Önlem |
| --- | --- |
| Aynı ada dosya var | `-1`, `-2` soneki (§5.8) |
| Dosya Excel'de açık (kilitli) | `IOException` yakalanır → `E-EXP-071`: "Dosya Excel'de açık. Kapatıp yeniden deneyin." |
| İki export aynı anda | `SemaphoreSlim(1,1)` (tek kullanıcı kabulü, `docs/02` §5.2) |
| Şablon değişmiş | Export öncesi hash kontrolü → `E-EXP-011` |
| Yarım yazılmış dosya | Geçici dosya + atomik `File.Move` (E9) |

---

## 6) Şablon sürüm yönetimi

### 6.1 Dosya yerleşimi

| Yol | İçerik | Erişim |
| --- | --- | --- |
| `templates/weekly-plan-template.xlsx` | Kullanıcıdan gelen şablon | **Salt-okunur** (`docs/02` §2.2) |
| `templates/fields.json` | Mantıksal isim → fiziksel adres/isimli aralık haritası | Sürüm kontrolünde |
| `templates/template-manifest.json` | Şablon sürümü, hash, keşif tarihi, envanter | Sürüm kontrolünde |
| `templates/beklenen/cikti-ornek.xlsx` | Golden-file beklenen çıktı | Test |
| `tests/fixtures/excel/` | Test girdileri (§8.1) | Test |

### 6.2 Manifest içeriği

| Alan | Örnek | Amaç |
| --- | --- | --- |
| `sablon_surum` | `"1.0.0"` | Uyum kontrolü |
| `sha256` | `"a3f1…"` | Şablonun değişmediğini doğrulama |
| `kesif_tarihi` | `"2026-11-02"` | Denetim |
| `kesfeden` | `"KE-1…KE-7"` | Hangi adımların koştuğu |
| `sayfalar[]` | `["PLAN","ROTASYON"]` | Sayfa varlığı |
| `isimli_araliklar[]` | `["PLAN_GUN_ETIKET", "PLAN_HUCRE_BLOK"]` | Tercih edilen erişim yolu |
| `ozellikler{}` | `pivot:false, slicer:false, makro:false, veri_dogrulama:true, kosullu_bicim:3` | ClosedXML yeterlilik kararı (`docs/02` D1) |
| `yazdirma{}` | `print_area:"A1:AZ60", yon:"landscape", olcek:85` | Assert kaynağı |

### 6.3 Şablon değişirse

| Durum | Tespit | Davranış |
| --- | --- | --- |
| Hash aynı, sürüm aynı | `sha256` eşleşir | Normal çalışma |
| Hash farklı, sürüm aynı | Hash uyuşmazlığı | `E-SAB-001`: "Şablon dosyası değişmiş. Yeniden keşif gerekli." Export kilitli |
| Sürüm farklı, uygulama destekliyor (`min_sablon_surum ≤ s ≤ max`) | Manifest sürümü | Uyarı `W-SAB-002` + keşif sihirbazı önerilir; kullanıcı onaylarsa devam |
| Sürüm uygulamanın desteklemediği kadar yeni | `s > max_sablon_surum` | `E-SAB-003`: "Bu şablon uygulama sürümüyle uyumsuz. Güncelleme gerekli." |
| Manifest yok | Dosya var, manifest yok | Keşif sihirbazı zorunlu (KE-2…KE-7) |
| Şablon yok | Dosya yok | Import çalışır; export kilitli (`E-SAB-004`), kullanıcı dosya seçebilir |

### 6.4 Şablon yoksa uygulama ne yapar

| Mod | Davranış |
| --- | --- |
| Import | Tam çalışır (okuma şablon gerektirmez) |
| Export | Buton pasif + gerekçe metni; "Şablon seç…" akışı |
| Sıfırdan üretim | **Yok** (ADR-011) |
| Varsayılan şablon indirme | **Yok** (ağ erişimi yok, `docs/05` kapsam dışı) |

---

## 7) Hata ve raporlama

### 7.1 Import hataları

| Kod | Önem | Konum bilgisi | Türkçe mesaj | Kullanıcı aksiyonu |
| --- | --- | --- | --- | --- |
| `E-IMP-001` | Hata | Dosya | "Dosya açılamadı veya bozuk." | Excel'de açıp yeniden kaydet |
| `E-IMP-002` | Hata | Dosya | "Dosya 20 MB sınırını aşıyor." | Haftayı bölerek aktar |
| `E-IMP-010` | Hata | Sayfa | "Sayfa tipi belirlenemedi (matris/rotasyon)." | Sayfa tipini seç |
| `E-IMP-020` | Hata | Sayfa | "Gün veya plaka ekseni bulunamadı." | Şablon keşfi çalıştır |
| `E-IMP-032` | Hata | Hücre | "Plaka baştaki sıfırı kaybetmiş (30 ≠ 030)." | Hücreyi metin biçimine al |
| `E-IMP-033` | Hata | Hücre | "'<kod>' nöbet kodu hat sözlüğünde yok." | Hattı tanımla, yeniden aktar |
| `W-IMP-011` | Uyarı | Sayfa | "Sayfa tipi düşük güvenle belirlendi." | Kontrol et |
| `W-IMP-012` | Uyarı | Hücre | "Tarih aralığı 7 gün değil." | Tarihi düzelt |
| `W-IMP-013` | Uyarı | Sayfa | "Matris ve rotasyon sayfalarındaki tarih farklı." | Doğru olanı seç |
| `W-IMP-021` | Uyarı | Hücre | "'<değer>' kodu tanınmadı, ham değer korundu." | Kodu düzelt |
| `W-IMP-022` | Bilgi | Hücre | "'6' hat numarası olarak yorumlandı." | Anlamı onayla (O1) |
| `W-IMP-031` | Uyarı | Hücre | "Birleşik hücre değeri sol-üstten okundu." | Gerekirse birleşimi kaldır |
| `W-IMP-041` | Uyarı | Hücre | "'221' plakası filoda yok, pasif eklendi." | Filoyu güncelle |
| `W-IMP-042` | Uyarı | Kolon | "Yinelenen plaka kolonu; ilki kullanıldı." | Kolonu sil |
| `W-IMP-043` | Uyarı | Satır/Kolon | "Gizli satır/kolon okundu." | Bilgi |
| `W-IMP-050` | Uyarı | Hafta | "Günlük araç sayısı toplamı tablodaki =76 ile uyuşmuyor (74)." | Hücreleri kontrol et (`docs/01` §9/5) |
| `W-IMP-051` | Uyarı | Hafta | "Aynı araç aynı gün iki görevde." | Planı düzelt |
| `W-IMP-060` | Bilgi | Kolon | "Sol kenar yardımcı sayılar v1'de okunmuyor." | — |

### 7.2 Export öncesi validator

| Kod | Önem | Kural | Sonuç |
| --- | --- | --- | --- |
| `V-001` | Hata | Hafta tarih aralığı boş veya 7 gün değil | Export durur |
| `V-002` | Hata | `Hafta` için hiç `Atama` yok | Export durur |
| `V-003` | Hata | Aynı araç + gün + sefer çakışması | Export durur |
| `V-004` | Hata | Plaka filoda yok veya `aktif=false` ama atama var | Export durur |
| `V-005` | Hata | Şablon/manifest doğrulanamadı (§6.3) | Export durur |
| `V-006` | Hata | Rotasyon listesi şablon alanını aşıyor (§5.5) | Export durur |
| `V-007` | Uyarı | `durum=belirsiz` atama var | Onayla devam |
| `V-008` | Uyarı | Günlük araç sayısı şablondaki formülle uyuşmuyor | Bilgi + rapor |
| `V-009` | Uyarı | `Hat` sözlüğünde eksik `hat_kodu` (atamada geçen) | Onayla devam |
| `V-010` | Uyarı | Boş gün (hiç atama yok) | Onayla devam |
| `V-011` | Uyarı | Not alanı 200 karakteri aşıyor | Kırpılır |

Validator sonucu: `Error` sayısı > 0 → dosya yazılmaz; `Warning` varsa onay diyaloğu (Türkçe, madde madde). Rapor `cikti/<ad>.validator.txt` olarak da kaydedilir.

### 7.3 Loglama

| Olay | Seviye | İçerik |
| --- | --- | --- |
| Import başlangıç/bitiş | Information | dosya yolu, süre, sayfa tipi, kayıt sayısı |
| Her uyarı | Warning | kod, sayfa, hücre, ham değer |
| Her hata | Error | kod, istisna, stack (UI'ya dökülmez) |
| Export başlangıç/bitiş | Information | şablon sürümü, çıktı yolu, süre, hücre sayısı |
| Şablon hash uyuşmazlığı | Warning | beklenen/gerçek hash |
| Validator sonucu | Information | hata/uyarı sayıları |
| Log konumu | — | `%APPDATA%/KbPlan/loglar/kbplan-<tarih>.log` (Serilog, `docs/02` §6) |

Kural: kullanıcıya gösterilen mesajda teknik detay yok; "Ayrıntı" genişletmesi + log yolu gösterilir (`docs/02` §6).

---

## 8) Golden-file test stratejisi

### 8.1 Dosya yerleşimi

| Yol | İçerik |
| --- | --- |
| `tests/fixtures/excel/sablon/weekly-plan-template-v1.xlsx` | Test şablonu (gerçek şablonun anonimleştirilmiş kopyası) |
| `tests/fixtures/excel/girdi/hafta-2026-10-26.xlsx` | Import girdisi (Tip A + Tip B) |
| `tests/fixtures/excel/girdi/hafta-2026-10-26-beklenen.json` | Import sonucu beklenen normalize model (JSON snapshot) |
| `tests/fixtures/excel/beklenen/plan-2026-11-02.xlsx` | Export golden çıktı |
| `tests/fixtures/excel/bozuk/` | Hatalı dosyalar (boş sayfa, eksen yok, birleşik gövde, `030`→`30`) |

Testler `KbPlan.Infrastructure.Tests` içinde (xUnit v3 + FluentAssertions 7.2.2, `docs/02` §7.1). Fixture dosyaları **binary** olduğu için `.gitattributes` ile `-text` işaretlenir; boyut sınırı 200 KB/dosya.

### 8.2 Karşılaştırma kuralları

| Katman | Kural | Tolerans |
| --- | --- | --- |
| Değer bazlı | Hücre değeri (`GetFormattedString` değil, ham `Value`) karşılaştırılır | Tam eşitlik |
| Sayısal | `int`/`double` karşılaştırma | `double` için `1e-9` |
| Metin | Türkçe karakter dahil tam eşitlik (`Şube`, `İstasyon`, `Görev`) | Tam eşitlik |
| Biçim bazlı | Yalnızca **sınırlı alan**: yazı tipi adı/boyutu, dolgu rengi, kenarlık varlığı, sayı biçimi | Renkler ARGB tam; ölçü ±0.5 |
| Formül bazlı | `HasFormula` + formül metni birebir | Tam eşitlik |
| Yapısal | Sayfa adları, sayfa sayısı, `PrintArea`, `PageSetup` yön/ölçek, birleşik aralık listesi | Tam eşitlik |
| Şablon bütünlüğü | Şablon dosyası SHA-256 değişmemiş | Tam eşitlik |
| Sıra bağımsız | `Atama` koleksiyonu `(gun, plaka, hat_kodu)` anahtarıyla sıralanıp karşılaştırılır | — |
| Zaman | Export zamanı gibi alanlar karşılaştırma dışı (`META_CIKTI_ZAMANI` maskelenir) | — |

### 8.3 Test senaryoları (14)

| # | Senaryo | Girdi | Beklenen | Katman |
| --- | --- | --- | --- | --- |
| G-01 | Tip A matrisi okuma | `hafta-2026-10-26.xlsx` (PLAN sayfası) | 45 plaka × 7 gün; `Atama` sayısı ve 10 örnek hücre eşleşir | Import |
| G-02 | Tip B rotasyon okuma | aynı dosya (ROTASYON sayfası) | Gün başına sıralı plaka listesi + `sira_no` doğru; `YAT` bloğu `durum=YAT` | Import |
| G-03 | Sayfa tipi tespiti | 4 farklı sayfa (A, B, belirsiz, boş) | A/B doğru sınıflanır; belirsizde `E-IMP-010` | Import |
| G-04 | Hücre kodu normalizasyonu | 24 kodluk tablo (`A`, `A1`, `7A`, `9AT`, `5x`, `-20`, `20.30`, `(7A)`) | Her kod beklenen alanlara dönüşür (§3.3) | Birim (parser) |
| G-05 | Türkçe karakter ve `â` | `PLÂKALAR`, `ÇARŞAMBA`, `İstasyon` | Bozulma yok; etiket eşleşir | Import + Export |
| G-06 | Birleşik başlık + boş hücre | Başlık 3 satıra birleşik, 6 boş gövde hücresi | Başlık atlanır, boş hücre `Atama` üretmez, `W-IMP-031` yok (normal başlık) | Import |
| G-07 | Bilinmeyen kod | `ZZ9` hücresi | `W-IMP-021` üretilir, ham değer `Atama.not`'ta, import tamamlanır | Import |
| G-08 | Şablon koruyan export | 1 hafta model + `weekly-plan-template-v1.xlsx` | Değerler yazılır; `PrintArea`, `PageSetup`, koşullu biçim sayısı, sütun genişliği değişmez | Export |
| G-09 | Formül koruma | Şablondaki günlük sayım + toplam hücreleri | `HasFormula=true`, formül metni birebir aynı; `CachedValue` yazılmamış | Export |
| G-10 | Golden-file karşılaştırma | G-08 çıktısı vs `beklenen/plan-2026-11-02.xlsx` | Hücre bazlı diff boş (maskeleme hariç) | Export |
| G-11 | Üzerine yazma koruması | Aynı adla 3 kez export | `plan_...-1.xlsx`, `plan_...-2.xlsx` oluşur; ilk dosya değişmez | Export |
| G-12 | Şablon yok / hash farklı | `templates/` boş; sonra hash'i bozulmuş şablon | `E-SAB-004` / `E-SAB-001`; export dosyası üretilmez | Export |
| G-13 | Rotasyon alanı taşması | 30 atama, şablon 24 satır | `E-EXP-041`, dosya yazılmaz | Export |
| G-14 | Performans (perf trait) | 45 araç × 7 gün × 6 sefer | Import < 800 ms, export < 1500 ms (§9) | Perf |

> 14 senaryo tanımlı; kabul için en az 8'i (G-01, G-02, G-04, G-08, G-09, G-10, G-11, G-12) zorunludur.

### 8.4 Test verisi üretimi

| Konu | Kural |
| --- | --- |
| Gerçek veri | Kullanıcı dosyası **doğrudan** repoya konmaz; plakalar `003…045` aralığına anonimleştirilir |
| Şablon | Gerçek şablonun yapısı korunur, kurum adı/logo kaldırılır |
| Beklenen JSON | `Import → serialize` ile bir kez üretilir, elle gözden geçirilir, sonra donar |
| Güncelleme | Beklenen dosya ancak davranış **bilinçli** değiştiğinde güncellenir; PR'da gerekçe yazılır |

---

## 9) Performans

### 9.1 Hedefler

| İşlem | Veri hacmi | Hedef | Üst sınır |
| --- | --- | --- | --- |
| Import (Tip A) | 45 plaka × 7 gün = 315 hücre + 45 nöbet | ≤ 400 ms | 1 sn |
| Import (Tip A + Tip B) | 315 + 315 hücre + YAT listeleri | ≤ 800 ms | 2 sn |
| Export (şablon doldurma) | ~400 hücre yazma | ≤ 1200 ms | 2.5 sn |
| Export sonrası doğrulama (geri okuma) | aynı dosya | ≤ 300 ms | 1 sn |
| Bellek (tepe) | tek hafta | ≤ 150 MB | 300 MB |
| Çıktı dosya boyutu | tek hafta | ≤ 500 KB | 2 MB |

Referans: `docs/02` §4.1 "ClosedXML ~1–3 sn / 10k hücre" — 400 hücre bu sınırın çok altında; hedef gerçekçi.

### 9.2 Büyük dosya davranışı

| Durum | Davranış |
| --- | --- |
| `UsedRange` > 50.000 hücre | Uyarı `W-IMP-070`: "Dosya beklenenden büyük (n hücre). İşlem uzun sürebilir." |
| Dosya > 20 MB | `E-IMP-002` (reddet) |
| Sayfa sayısı > 10 | Yalnızca Tip A/B olarak sınıflanan sayfalar işlenir, diğerleri atlanır + bilgi logu |
| 300 araç × 31 gün (aylık dosya) | v1 kapsamı değil; import reddedilmez ama hedef süre 10 sn'ye kadar gevşetilir, `W-IMP-071` |
| Bellek baskısı | ClosedXML tüm çalışma kitabını belleğe alır (streaming yok) → 150 MB hedefi aşılırsa işlem iptal + `E-IMP-080` |

### 9.3 Optimizasyon kuralları

| Kural | Gerekçe |
| --- | --- |
| `XLEventTracking.Disabled` | Gereksiz olay izleme maliyeti |
| Hücrelere tek tek `Worksheet.Cell(...)` yerine `Range` üzerinden toplu okuma | Adres çözümleme maliyeti |
| `Style` nesnesine yazma sırasında dokunulmaz | Stil kopyalama en pahalı işlem |
| `AdjustToContents` yok | Hem yavaş hem yazdırma düzenini bozar |
| `SaveAs` tek sefer | Ara kayıt yok |
| Ölçüm | `Stopwatch` + `[Trait("Category","Perf")]` testi; CI'da ayrı iş (Release) |

---

## 10) Açık sorular ve varsayımlar

### 10.1 `docs/01` §9 sorularından Excel'e doğrudan etki edenler

| `docs/01` §9 # | Soru (kısa) | Excel etkisi | Seçilen varsayılan | Etiket |
| --- | --- | --- | --- | --- |
| 1 | Tek rakam kodları sefer sayısı mı, hat no mu? | Hücre → `sefer_sayisi` / `hat_no` ayrımı | **Hat numarası** → `Hat.hat_no`/`Atama.hat_no`; `sefer_sayisi` hücreden türetilmez (V-01) | **ONAYLANDI (2026-10-27)** — O1 |
| 2 | `9AT` içindeki `T` nedir? | `varyant` alanına yazılıyor | `varyant="T"` ham korunur, anlam eşlenmez (V-02) | **kullanıcı onayı gerekli** |
| 3 | `A1` ile `1A` aynı mı? | Parse kuralı | İkisi de `vardiya=A, sira_no=1` (V-03); `sefer_sayisi` türetilmez (O1) | **kullanıcı onayı gerekli** |
| 4 | Günlük araç sayısı gerçekten araç sayısı mı? | Sağ kolon doğrulaması | Araç sayısı kabul edilir; uyuşmazlık uyarı (V-04) | varsayım |
| 5 | Okunamayan toplamlar (`=66`, `=101`…) | Import doğrulama toleransı | Toplam uyuşmazsa `W-IMP-050`, import devam (V-18) | varsayım |
| 6 | `221` mi `229` mu? | `Arac.plaka` | **ONAYLANDI (2026-10-27): 45 plaka**; elle yazılan `229` geçerli ek kayıt, basılı `221` silinmez; import'ta ikisi de okunur, `kaynak` alanı ile ayrılır (V-06) | **ONAYLANDI (2026-10-27)** — O5 |
| 7 | `085` mi `225` mi? | `Arac.plaka` | **ONAYLANDI (2026-10-27): 45 plaka**; elle yazılan `225` geçerli ek kayıt, basılı `085` silinmez; import'ta ikisi de okunur, `kaynak` alanı ile ayrılır (V-06) | **ONAYLANDI (2026-10-27)** — O5 |
| 8 | `080` neden elle yazılmış? | Plaka sözlüğü | `080` geçerli plaka kabul edilir (V-07) | varsayım |
| 9 | Matris mi rotasyon mu doğru kaynak? | Import tek doğruluk kaynağı | **Tip B esas**, Tip A çapraz doğrulama (V-08) | **ONAYLANDI (2026-10-27)** — O2 |
| 10 | `NÖBET` kolonundaki değer ne? | `Nobet.nobet_kodu` → `Hat` | **ONAYLANDI (2026-10-27):** `x` = nöbet günü, `NÖBET` değeri o günün **hat kodu** (H4); kod `Hat` sözlüğüne çözülür, çözülemeyen kod import hatası `E-IMP-033` (V-09) | **ONAYLANDI (2026-10-27)** — H4 + kullanıcı teyidi |
| 11 | `YAT` bloğu kuralı nedir? | `Atama.durum=YAT` | YAT altındaki tüm plakalar `YAT`; gerekçe alanı boş (V-10) | varsayım |
| 12 | `2. Töre` nedir? | `GorevGrubu.ad` | Serbest metin olarak saklanır; parantez içi `arac_sayisi` (V-11) | varsayım |
| 14 | `-20` gibi eksi kodlar ne? | `ek_gorev` bayrağı | `ek_gorev=true`, `hat_no=20` (V-12) | **kullanıcı onayı gerekli** |
| 15 | `12.00` saat mi? | Hücre tipi (metin mi saat mi) | Saat kabul edilir; `TimeSpan` yazılır (V-13) | **kullanıcı onayı gerekli** |
| 16 | `(4) (20)` / `(7A) (9)` çiftleri ne? | `Gun.ana_hat_kodu` | İlk daire = ana hat, ikincisi `not` (V-14) | **kullanıcı onayı gerekli** |
| 17 | `12G` / `12P` ne? | `not` alanı | `hat_no=12`, sonek `not` (V-15) | varsayım |
| 19 | Başlıksız matrisler hangi haftaya ait? | `Hafta` eşlemesi | Tarih yoksa kullanıcıdan hafta istenir; tahmin yapılmaz (V-16) | varsayım |
| 20 | 7 haftalık döngü doğru mu? | Export'ta rotasyon sırası | **Resmî kural** (O4); döngü **export'ta uygulanmaz**, plan motordan gelir (`docs/03` R7 sert) (V-17) | **ONAYLANDI (2026-10-27)** — O4 |

### 10.2 Excel İO'ya özgü varsayımlar

| # | Varsayım | Gerekçe | Etki | Durum (2026-10-27) |
| --- | --- | --- | --- | --- |
| V-01 | Sayısal hücre = `hat_no` (tek/çift hane farkı yok); `sefer_sayisi` hücreden türetilmez | O1: hücredeki tek rakam hat numarasıdır | Yanlışsa tüm kod eşlemesi değişir | **ONAYLANDI** (O1) |
| V-02 | `varyant` ham harf olarak saklanır | Anlam bilinmiyor; veri kaybı olmasın | Raporlama anlamı eksik kalır | BEKLİYOR (S2) |
| V-03 | `A1` = `1A` | Aynı hücrelerde karışık yazım | Çift sayım riski | BEKLİYOR (S3) |
| V-04 | Sağ kolon = günlük görevli araç sayısı | `docs/01` §4 doğrulanmış toplam (8+4+8+8+8+20+20=76) | Doğrulama kuralı buna dayanıyor | BEKLİYOR (S4 — O1–O4 kapsamı dışı) |
| V-05 | Hafta Pazartesi başlar | `docs/00` glossary `HAFTA` tanımı | Gün sırası kayması | VARSAYIM (S listesinde değil) |
| V-06 | Elle yazılan plaka **geçerli ek kayıttır**, basılı değer silinmez; ikisi de okunur ve `Arac.kaynak` (`basili`/`elle`) ile ayrılır | O5 (2026-10-27): 45 plaka kararı; `229` ve `225` elle yazılmış geçerli kayıt, `221`/`085` basılı kalır | `229` gerçekte `221`'in yerine geçen bir düzeltme ise filo 44'e düşer (risk); pilot hafta (G02) elle karşılaştırması bunu kapatır | **ONAYLANDI (2026-10-27)** — O5 |
| V-07 | `080` geçerli plaka | 41'lik basılı listede var | — | BEKLİYOR (S8) |
| V-08 | **Tip B doğruluk kaynağı**; Tip A çapraz doğrulama | O2: esas kaynak gün = kolon / plaka = dikey liste | Çelişkide yanlış plan | **ONAYLANDI** (O2) |
| V-09 | `Nobet.nobet_kodu` = hat kodu, `Hat` sözlüğüne çözülür | H4 + kullanıcı onayı (2026-10-27): değer nöbet günündeki **hat kodu**dur | Çözülemeyen kod import hatası `E-IMP-033` (uyarı değil); `varsayim_mi=0` | **ONAYLANDI (2026-10-27)** |
| V-10 | `YAT` altı = görevsiz | `docs/01` §2 | Yatan araç yanlış işaretlenebilir | BEKLİYOR (S11) |
| V-11 | Görev grubu serbest metin | Adlandırma tutarsız (`B.Evler`/`B.Çukur`) | Grup bazlı rapor kırılgan | BEKLİYOR (S12) |
| V-12 | Eksi kod = ek görev | `docs/01` §3 en olası anlam | Saat ise yanlış | BEKLİYOR (S14) |
| V-13 | `dd.MM` + `.00` = saat | `docs/01` §3 | Sefer no ise yanlış | BEKLİYOR (S15) |
| V-14 | İlk daire ana hat | Kolon üstü konum | İkinci daire yok sayılır | BEKLİYOR (S16) |
| V-15 | `G`/`P` sonek → `not` | Anlam belirsiz | — | BEKLİYOR (S17) |
| V-16 | Tarihsiz dosyada tahmin yok | Yanlış haftaya yazma riski (`docs/01` §9/19) | Kullanıcı adımı gerekir | BEKLİYOR (S19) |
| V-17 | 7 haftalık döngü export'ta uygulanmaz | O4: döngü resmî ama sorumluluk plan motorunda (`docs/05` M3) | Excel katmanı saf yazıcı kalır | **ONAYLANDI** (O4) |
| V-18 | Günlük sayı/toplam uyuşmazlığı import'u durdurmaz, uyarı üretir | Görsellerde okunamayan toplamlar var (`docs/01` §9/5); veri kaybı olmasın | Hatalı toplam sessizce kabul edilmez, raporda görünür | BEKLİYOR (S5) |

### 10.3 Kullanıcı onayı bekleyen kritik maddeler (özet, 2026-10-27 günceli)

| Öncelik | Madde | Neden bloke eder |
| --- | --- | --- |
| 1 | V-12 / V-13 (eksi kod, saat) | Hücre tipi yanlış yazılır |
| 2 | Elle iptal gösterimi (O3 sonrası `x` nöbet oldu) | İptal hücreye nasıl yazılacak: üstü çizik mi, ayrı gösterim mi? |
| 3 | §2.5/S2–S3 (şablon keşfi görüşmesi) | Hücre haritası ve formül politikası |

**Kapanan maddeler:** V-01 (O1: tek rakam = hat no), V-06 (O5: 45 plaka, elle yazılan değer geçerli ek kayıt), V-08 (O2: Tip B esas), V-09 (H4 + kullanıcı onayı 2026-10-27: NÖBET kodu = hat kodu, `Hat` sözlüğüne çözülür), V-17 (O4: döngü resmî, export yalnızca yazar). §2.5/S1 (hangi sayfa esas) O2 ile cevaplandı.

---

## Ek: Doğrulama durumu

| Madde | Durum |
| --- | --- |
| `dotnet build` / `dotnet test` | **doğrulanmadı: bu doküman turunda çalıştırılmadı**; SDK 10.0.403 kuruldu (2026-10-27), M2'de çalıştırılacak |
| Şablon dosyası incelemesi | **yapılmadı: dosya bu makinede yok** → §2.5 KE adımı |
| Hücre adresleri | Mantıksal isim; fiziksel adres keşif sonrası `templates/fields.json` |
| Golden-file dosyaları | Henüz üretilmedi (M4 çıktısı, `docs/05`) |
| Kullanıcı onayları | O1–O5 + H4 (NÖBET semantiği) + NÖBET kodu = hat kodu (2026-10-27) işlendi; açık alt soru yok (yalnızca `×` gün sınırı pilot teyidi) |

---

### Cikti politikasi (K6, 2026-11-01)

K6 kullanıcı kararı (2026-11-01) uyarınca çıktı politikası:
- Tek dosya çıktısı `.xlsx` olup şablonu koruyarak üretilir.
- PDF ve yazdırma v1 kapsam dışıdır (`docs/05` §6).
- Yazdırma alanı (`PrintArea`) şablonla birlikte korunur, uygulama PDF üretmez.

| Konu | Kural |
| --- | --- |
| Dosya çıktısı | Yalnızca `.xlsx` (şablon korunarak üretilir) |
| PDF / Yazdırma | v1 kapsam dışı (Raporlar ekranı ekran içi özet üretir) |
| PrintArea | Şablonla birlikte korunur, uygulama PDF üretmez |
