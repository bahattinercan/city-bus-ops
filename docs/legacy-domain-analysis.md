# 01 — Alan Analizi: Kütahya Şehir İçi Otobüs Haftalık Plan Tabloları

Kaynak: `proje resimleri/` altındaki 21 adet JPEG (elle doldurulmuş, basılı plan tablosu fotoğrafı).
Yöntem: her görsel `read` ile açıldı; okunabilirlik için `/tmp/bus/` altında 90° döndürülmüş (`magick -rotate -90`) ve kırpılmış kopyalar üretildi. **Orijinal dosyalara dokunulmadı.**
Bu belgedeki her iddia görsel numarasına (`G01`…`G21`) bağlanmıştır. Emin olunmayan her yorum **hipotez** olarak işaretlenmiştir.

---

## 0) Kullanıcı onayları (2026-10-27)

Aşağıdaki kararlar kullanıcı tarafından 2026-10-27 tarihinde onaylanmıştır ve bu dokümanda bağlayıcıdır. Metin, ilgili bölümlerde bu kararlara göre düzeltilmiştir.

| Kod | Karar | Etkilenen bölümler |
| --- | --- | --- |
| O1 (S1) | Hücredeki tek rakam kodlar (`2`, `5`, `6`, `7` …) = **hat numarası**. Sefer sayısı **değildir**. | §3 (hücre kodu envanteri), §9/1 |
| O2 (S9) | Doğru/esas kaynak **Tip B** (gün = kolon, plaka = dikey rotasyon listesi). Tip A matris ikincil/özet görünüm. | §2 (tablo tipleri), §9/9 |
| O3 | Hücredeki `x` işareti = **nöbet** anlamına gelir (iptal/çalışmıyor anlamına **gelmez**). | §3, §7, §9/10 |
| O4 (S20) | 7 haftalık görev-grubu gün kayması **resmi kuraldır** (döngü 7 hafta). | §6.1, §10 |
| O5 | S6/S7 (`221`/`229` ve `085`/`225`) **henüz cevaplanmadı**; kullanıcıya fotoğrafta yerleri gösterildi, cevap bekleniyor. | §5.1, §9/6–7 |

---

## 1) Görsel envanteri

Numaralandırma: dosya adındaki zaman damgası + parantez sırası (doğal sıra). `G01` = `21.47.17.jpeg`.

| No | Dosya adı | Tablo tipi | Tarih aralığı başlığı | Okunabilirlik | Not |
| --- | --- | --- | --- | --- | --- |
| G01 | WhatsApp Image 2026-10-27 at 21.47.17.jpeg | B — dikey rotasyon (gün = kolon) | 26.10.2026 – 01.11.2026 | Orta (rotasyon listesi net, kodlar silik) | 7 gün kolonu; `YAT` ayırıcıları var |
| G02 | …17 (1).jpeg | A — matris (gün = satır, plaka = kolon) | 26.10.2026 – 01.11.2026 (kısmen okundu) | İyi | Sağ kolonda günlük araç sayısı + `=76` |
| G03 | …17 (2).jpeg | A — matris | 19.10.2026 – 25.10.2026 | İyi | `NÖBET` satırı ve `=66` toplamı var |
| G04 | …17 (3).jpeg | B — dikey rotasyon | 19.10.2026 – 25.10.2026 | İyi | G03'ün gün-liste karşılığı |
| G05 | …18.jpeg | A — matris | 12.10.2026 – 18.10.2026 | İyi | Sol kenarda yardımcı sayı kolonları |
| G06 | …18 (1).jpeg | B — dikey rotasyon | 12.10.2026 – 18.10.2026 | İyi | G05'in karşılığı |
| G07 | …18 (2).jpeg | B — dikey rotasyon | 05.10.2026 – 11.10.2026 | İyi (masa üstü, aksesuar var) | G09 ile aynı tabakanın 2. fotoğrafı |
| G08 | …18 (3).jpeg | A — matris | 05.10.2026 – 11.10.2026 | Orta (kırmızı çapraz tarama kodları örtüyor) | G10 ile aynı tabaka |
| G09 | …19.jpeg | B — dikey rotasyon | 05.10.2026 – 11.10.2026 | Çok iyi (en temiz rotasyon örneği) | G07 ile aynı içerik |
| G10 | …19 (1).jpeg | A — matris | **başlık yok** (üst kenar kesik) | Orta | İçerik G08 ile aynı; üstte karalama/çentik izleri |
| G11 | …19 (2).jpeg | B — dikey rotasyon | 28.09.2026 – 04.10.2026 | İyi | G12 ile aynı içerik |
| G12 | …19 (3).jpeg | B — dikey rotasyon | 28.09.2026 – **04.09.2026** (yazım hatası) | İyi | G11'in 2. fotoğrafı; başlıkta ay hatası |
| G13 | …19 (4).jpeg | A — matris | **başlık yok** (kesik) | Orta | Hipotez: 28.09 haftası (bkz. §1.1) |
| G14 | …19 (5).jpeg | A — matris | 21.09.2026 – 27.09.2026 | Orta (çapraz tarama) | `=71` (şüpheli) |
| G15 | …19 (6).jpeg | B — dikey rotasyon | 21.09.2026 – 27.09.2026 | İyi | G14'ün karşılığı |
| G16 | …19 (7).jpeg | A — matris | **başlık yok** (kesik) | İyi (en yoğun tablo) | `=101` toplamı okundu; hipotez: 14.09 haftası |
| G17 | …19 (8).jpeg | B — dikey rotasyon | 14.09.2026 – 20.09.2026 | İyi | 14.09–20.09 haftasının tek görseli |
| G18 | …19 (9).jpeg | B — dikey rotasyon | 07.09.2026 – 13.09.2026 | İyi | G19, G20 ile aynı içerik |
| G19 | …19 (10).jpeg | B — dikey rotasyon | 07.09.2026 – 13.09.2026 | İyi | G18'in 2. fotoğrafı |
| G20 | …19 (11).jpeg | B — dikey rotasyon | 07.09.2026 – 13.09.2026 | İyi | G18'in 3. fotoğrafı |
| G21 | …19 (12).jpeg | A — matris | 07.09.2026 – 13.09.2026 | İyi | `=126` (şüpheli); `198/200/203` sütunları fosforlu |

### 1.1 Görsel → hafta eşleşmesi (özet)

| Hafta | Matris (A) | Rotasyon (B) |
| --- | --- | --- |
| 07.09.2026 – 13.09.2026 | G21 | G18, G19, G20 |
| 14.09.2026 – 20.09.2026 | G16 (başlıksız — hipotez) | G17 |
| 21.09.2026 – 27.09.2026 | G14 | G15 |
| 28.09.2026 – 04.10.2026 | G13 (başlıksız — hipotez) | G11, G12 |
| 05.10.2026 – 11.10.2026 | G08, G10 | G07, G09 |
| 12.10.2026 – 18.10.2026 | G05 | G06 |
| 19.10.2026 – 25.10.2026 | G03 | G04 |
| 26.10.2026 – 01.11.2026 | G02 | G01 |

- 8 farklı hafta, 2 farklı tablo tipi, 21 fotoğraf (5 tanesi mükerrer çekim: G10=G08, G12=G11, G19/G20=G18, G09=G07).
- Her hafta için **iki ayrı kâğıt** var: biri araç→gün matrisi, diğeri gün→araç listesi (rotasyon). İkisi aynı planın iki görünümü (G03 ↔ G04, G05 ↔ G06, G14 ↔ G15).
- Başlıksız 2 matris (G13, G16) eksik kalan haftalara (28.09 ve 14.09) aittir — bu bir **çıkarım**, başlık okunamadı.

---

## 2) Tablo tipleri

### Tip A — Matris (gün × plaka)

Örnek: G02, G03, G05, G08, G10, G13, G14, G16, G21.

| Eksen | Anlam | Kanıt |
| --- | --- | --- |
| Satır (yukarıdan aşağıya) | Günler: **PAZAR, CUMARTESİ, CUMA, PERŞEMBE, ÇARŞAMBA, SALI, PAZARTESİ** — yani Pazartesi en altta, Pazar en üstte | G02 sol kolon (döndürülmüş kopyada alt→üst okunur); G03 sol kolon |
| En üst satır | `NÖBET` | G02, G03, G05, G08 sol üst hücre |
| Kolon (soldan sağa) | Plakalar: `003, 030, 042, 050, 053, 060, 080, 085, 086, 100, 125, 128, 129, 130, 146, 147, 153, 159, 160, 166, 176, 184, 188, 190, 198, 200, 203, 205, 208, 226, 229, 235, 251, 253, 260, 271, 272, 277, 284, 285, 286` | G03 alt kolon başlıkları; G05, G13, G16, G21 aynı sıra |
| En alt satır | `PLÂKALAR` etiketi + 1…41 sıra numarası | G02, G03, G05 alt kenar |
| En sağ kolon | Gün başına **araç sayısı** + hafta toplamı (`=76`, `=66`, `=101`…) | G02 sağ kenar; G16 `=101` |
| Sol kenar (Tip A) | Gün adının solunda 2–3 dar kolon: `10 / 4-15`, `6 / 18`, `8 / 32`, `7 / 25 / 4-10` gibi sayılar | G02 sol kenar (hipotez: günlük sefer sayısı + saat aralığı) |
| Hücre | Hat/görev kodu veya işaret: `6`, `7`, `2`, `A`, `S`, `7A`, `9A`, `9AT`, `5x`, `-20`, `x` | G02, G08, G13, G21 hücreleri |

### Tip B — Dikey rotasyon (gün = kolon, plaka = serbest liste)

Örnek: G01, G04, G06, G07, G09, G11, G12, G15, G17, G18, G19, G20.

| Eksen | Anlam | Kanıt |
| --- | --- | --- |
| Kolon | 7 gün: PAZARTESİ, SALI, ÇARŞAMBA, PERŞEMBE, CUMA, CUMARTESİ, PAZAR | G09, G15, G17 başlık satırı |
| Kolon içi satırlar | O gün çalışan araçların **sıralı plaka listesi** (plaka tek başına, kod yok) | G09 Pazartesi: `188, 286, 205, 271, 277, 285, 272, 203, 146, 80, 226, 30 …` |
| `YAT` satırı | Listenin ortasında/altında ayırıcı; altındaki plakalar o gün **görev almayan / yatan** araçlar | G09 (Pazartesi 2. blok), G04, G15 |
| Kolon üstü el yazısı | Görev grubu notu: `2. Töre (6) Toki`, `2.Töre (2) F.Şelebi`, `2.Töre (5) B.Çukur`, `2.Töre (1) Kampüs/Konya`, `2.Töre (5) B.Evler` | G04, G06, G11, G15, G17, G09 |
| Kolon üstü daireli sayı | Daire içinde kod çifti: `(8) (10)`, `(4) (20)`, `(7A) (9)`, `(3) (10)` | G07, G09, G15, G17 |
| Kolon altı daireli sayı dizisi | `(12) (13) (14) (15) (16) (22) (23) (24) (25) (26) (27) (21)` — dikey sıra | G07, G09, G11, G15 |

**Tip A ≠ Tip B özeti:** A, "her araç bugün hangi kodu alıyor" sorusuna; B, "bugün hangi araçlar sırayla hangi göreve gidiyor" sorusuna cevap verir. Aynı haftanın iki kâğıdı birbirini tamamlar (G03+G04, G05+G06, G14+G15).

**Esas kaynak (kullanıcı onayı O2, 2026-10-27):** doğru/esas kaynak **Tip B**'dir (gün = kolon, plaka = dikey rotasyon listesi); Tip A matris yalnızca ikincil/özet görünümdür.

---

## 3) Hücre kodu envanteri

Not: kodlar el yazısı olduğu için bazıları birden fazla okumaya açıktır. "Görüldüğü görseller" kolonu en az bir net örneğe dayanır.

| Kod | Görüldüğü görseller | En olası anlam | Alternatif anlam |
| --- | --- | --- | --- |
| `A` | G13, G16, G08, G21 | Vardiya tipi: "A vardiyası" (gündüz) | Hat harfi (A hattı) |
| `S` | G13, G16, G21, G08 | Vardiya tipi: "S" (ikinci vardiya / servis) | "Servis dışı" kısaltması |
| `A1` / `1A` | G02, G13, G16, G21 | Vardiya + sefer sırası (`A` vardiyası, 1. sefer) | `1A` numaralı hat |
| `7A` | G02, G05, G08, G21, G09 (üst not) | Hat kodu: 7A hattı (7 numaralı hattın A varyantı) | 7. bölge + A vardiyası |
| `8A`, `10A`, `12A` | G03, G05, G13, G21 | Aynı mantıkta hat kodları (8A, 10A, 12A) | Vardiya + bölge |
| `9A` | G02, G03, G05, G13 | 9A hattı | 9. hat + A vardiyası |
| `9AT` | G01, G03, G05, G13, G21 | `9A` + `T` eki: **T** = "Töre" ya da "tam gün" (tek seferde tüm gün) | "T" = takviye |
| `9S`, `7A(S)` | G16, G21 | `S` ekli hat/vardiya kombinasyonu | Sefer sonu varyantı |
| `5`, `6`, `4`, `3`, `2`, `1` (tek rakam) | G02, G08, G16 | Hat numarası (kullanıcı onayı O1, 2026-10-27) | — (kapandı) |
| `20`, `25`, `23`, `24`, `15`, `16`, `13`, `14`, `12` | G02, G03, G08, G21 | Hat numarası (çift haneli) | Sefer/görev no |
| `-20`, `-13`, `-12`, `-15`, `-16`, `-23`, `-25`, `-108` | G02, G03, G05, G13, G21 | **Negatif kod = ek görev** (ONAYLANDI 2026-11-01, S14): `-20` "20 hattına ilave görev" demektir; ham kod `gorev_kodu_ham` alanında saklanır, hat numarası normalize edilir | ~~Saat (20:00) veya negatif düzeltme~~ (REDDEDİLDİ) |
| `0-20`, `D-20`, `D` | G03, G13 | `D` = "devam/devir" ya da güzergâh harfi; `-20` ile birlikte | Durak/hat kısaltması |
| `5x`, `6x`, `4x`, `3x`, `2x`, `x2`, `x` | G02, G03, G05, G08, G13, G16, G21 | `x` = nöbet işareti: araç o gün nöbette (kullanıcı onayı O3). `5x` gibi kod+x kombinasyonu = hat 5 + nöbet (hipotez) | İptal anlamı KULLANICI TARAFINDAN REDDEDİLDİ |
| `26A`, `26B`, `26E`, `27A`, `27B`, `27E` | G03, G05, G13, G16, G21 | Görev grubu + araç sırası (`2. Töre 6A` gibi) veya 26/27 numaralı hatların varyantları | Saat + harf (26A = 26. durak) |
| `100`, `105`, `108` | G01, G02, G03, G16, G21 | Hat numarası (3 haneli) | Sefer no |
| `12G`, `12P` | G16 | Vardiya/hat + G/P eki (G = gündüz, P = pik?) | Personel sayısı |
| `12.00`, `13.00`, `14.00` | G16 | **Sefer başlangıç saati** (ONAYLANDI 2026-11-01, S15): aracın o günkü ilk seferi (örn. 12.00 = 12:00) | ~~Sefer sayısı~~ (REDDEDİLDİ) |
| `20.30` | G03 | **Sefer başlangıç saati** (ONAYLANDI 2026-11-01, S15): aracın o günkü ilk seferi (20:30) | ~~20.3 sefer~~ (REDDEDİLDİ) |
| `(1) (2) (3) (4) (5) (6) (7) (8) (9) (10)` | G01, G04, G06, G07, G09, G11, G15, G17 | Görev grubunun **araç sayısı** (`2. Töre (6)` = 6 araç) | Hat numarası |
| `(12) (13) (14) (15) (16) (21) (22) (23) (24) (25) (26) (27)` | G07, G09, G11, G15, G17 | Rotasyon sıra numarası / sefer no (dikey artan sıra) | Araç sayısı |
| `(7A)` | G07, G09, G17, G04 | Daire içinde hat kodu = o günün ana hattı | — |
| `YAT` | G01, G04, G06, G07, G09, G11, G15, G17, G18 | Görev almayan (yatan) araç bloğu ayırıcısı | "Yatakhane/gece parkı" |
| `NÖBET` | G02, G03, G05, G08, G14, G16, G21 | **Nöbet günü kodu:** plaka başına tek hücre (G02/G14'te sağ kenar kolonu). Değer, o plakanın nöbet günündeki hücrede `×` işaretinin yanına yazılan koddur (**hat kodu** — ONAYLANDI 2026-10-27: `2`, `4`, `5`, `6`; bir kez `20`). Nöbet günü yoksa hücre **boş** bırakılır (G14: 130, 166, 184, 208, 253, 285, 286). Kanıt ve eşleşme oranları: §4.1 | ~~Haftalık/aylık nöbet gün sayısı~~ (REDDEDİLDİ, §4.1) · ~~günlük nöbetçi araç sayısı~~ (REDDEDİLDİ, §4.1) |
| `PLÂKALAR` | Tüm Tip A görselleri | Kolon ekseni etiketi | — |
| `toplam`, `Toli/Toki`, `Demirci`, `otogar` | G03, G04, G06, G11, G15, G17, G18, G21 | Yer/kişi/servis noktası el notu (`otogar`, `Demirci`) | Sürücü adı |

**Onaylanmış durum (2026-10-27 / 2026-11-01):** hücredeki tek rakamların (`2`, `5`, `6`, `7` …) **hat numarası** olduğu (O1) ve hücredeki `x` işaretinin **nöbet** anlamına geldiği (O3) kullanıcı tarafından onaylandı. 2026-11-01 kararlarıyla: negatif kodlar (`-20`, `-13`, `-108` …) **ek görev** (S14: `-20` = 20 hattına ilave görev, ham kod `gorev_kodu_ham` alanında saklanır, hat numarası normalize edilir); `12.00`, `13.00`, `14.00`, `20.30` gibi değerler ise **sefer başlangıç saati** (S15: aracın o günkü ilk seferi) olarak onaylandı. Buna göre tek rakam kodları "sefer sayısı" olarak okunmaz; `x` de iptal/çalışmıyor anlamına gelmez.

---

## 4) Gün kolonları ve günlük araç sayıları

| Öğe | Anlam | Kanıt |
| --- | --- | --- |
| `PAZARTESİ … PAZAR` | 7 gün; Tip A'da satır, Tip B'de kolon | G09, G15 (B); G02, G03 (A) |
| Gün başlığı altındaki sayı (Tip A sağ kolon) | O gün **planda çalışan araç sayısı** | G02: 8, 4, 8, 8, 8, 20, 20 |
| Hafta toplamı (`=76`) | Günlük sayıların toplamı = **haftalık araç-gün sayısı** | G02: 8+4+8+8+8+20+20 = **76** (doğrulandı) |
| `NÖBET` kolonu | Araç başına nöbet bilgisi (nöbet gününün kodu) | G14 sağ kenar kolonu: `5, 4, 4, 2, 6, 20, 6, 5, 5, 2 …`; G02 aynı kolon `6, 6, 5, 4, 6, 5, 2, 4, (boş), 6 …` → ayrıntı §4.1 |

Doğrulanmış iki örnek:

| Görsel | Pzt | Sal | Çar | Per | Cum | Cmt | Paz | Toplam |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G02 (26.10 haftası) | 8 | 4 | 8 | 8 | 8 | 20 | 20 | **76** (tabloda `=76` yazılı) |
| G16 (başlıksız) | 12 | 8 | 18 | 8 | 13 | 24 | 18 | **101** (tabloda `=101` yazılı) |

Okunamayan/şüpheli toplamlar: G03 (`=66` yazılı, gün değerleri kısmen okundu), G05 (`=65`?), G08 (`=66`?), G14 (`=71`?), G21 (`=126`?), G13 (`=66`?). Bu tablolarda gün hücreleri kırmızı çapraz tarama veya fosforlu kalem altında kaldığı için tek tek sayılamadı → §9 soru 5.

**Hafta içi/sonu deseni (hipotez, güçlü):** hafta içi 4–12 araç, cumartesi–pazar 18–24 araç. Yani hafta sonu daha **fazla** araç çalışıyor (G02, G16, G21, G14). Bu, şehir içi hatların hafta sonu seyrek tarifeyle ama daha çok araçla mı, yoksa "görev (sefer) sayısı" olarak mı sayıldığı sorusunu doğurur → §9 soru 4.

**Tip B'de karşılığı:** gün kolonundaki plaka satırı sayısı (YAT üstü) = o gün görevli araç sayısı. Örnek: G09 Pazartesi kolonunda YAT üstü 17, YAT altı 8 satır → 17 görevli + 8 yatan.

### 4.1 NÖBET semantiği — derin inceleme (2026-10-27)

**Kapsam:** G15 (Tip B, 21.09–27.09.2026) ve aynı haftanın matrisi G14 (Tip A); çapraz doğrulama için G01 (Tip B, 26.10–01.11) + G02 (Tip A, aynı hafta). Yöntem: `/tmp/bus/nov/` altında üretilen 90° döndürülmüş ve kırpılmış kopyalar (`magick -crop … -resize 250–400%`) ile **hücre hücre** okuma; orijinal JPEG'lere dokunulmadı. G14'te NÖBET kolonu satırların sağındadır (plaka = satır); G02'de de öyle.

#### Hipotez testleri

| Hipotez | Test yöntemi | Sonuç |
| --- | --- | --- |
| **H1** — NÖBET = plakanın **haftalık nöbet gün sayısı** (= Tip B'de o plakanın `×` sayısı) | G15'in 7 gün kolonu ayrı ayrı kırpılıp 41 plakanın `×` işaretleri tek tek sayıldı; G14'ün aynı 41 satırdaki NÖBET değerleriyle karşılaştırıldı | **REDDEDİLDİ.** Sayısal eşleşme **0/41 (%0)**. G15'te hiçbir plakada 1'den fazla `×` yok (34 plakada 1, 7 plakada 0); NÖBET değerleri ise 2, 4, 5, 6 ve bir kez 20. Aralıklar kesişmiyor (maks `×` = 1 < min NÖBET = 2) |
| **H2** — NÖBET = **aylık** nöbet sayısı | (a) G14'te NÖBET değeri ile aynı satırdaki `×` işaretinin yanına yazılan kod karşılaştırıldı; (b) 060 plakasının değeri (20) aylık sayı olarak yorumlandı | **REDDEDİLDİ.** (a) Okunabilen **33/33 satırda** NÖBET değeri, `×`'in yanındaki kodla **birebir aynı** (ör. `×5` → 5, `6⊗` → 6, `×20×` → 20). Bir sayım değeri her satırda o günün hat koduyla çakışamaz. (b) 20 nöbet günü/ay, 41 araçlı filoda ve günde ~8–10 nöbetçi ile bağdaşmaz; 20 bir **kod**tur |
| **H3** — NÖBET kolonu = **günlük nöbetçi araç sayısı** (satır değil, kolon toplamı) | NÖBET kolonunun yapısı (plaka başına 41 hücre) ile G15'ten sayılan günlük nöbetçi sayıları karşılaştırıldı | **REDDEDİLDİ.** Kolon gün eksenli değil plaka eksenlidir (41 değer, 7 değil). G15 günlük `×` sayıları 8 / 0 / 10 / 0 / 0 / 8 / 8; bu diziler NÖBET kolonunda hiçbir biçimde görünmüyor. Günlük nöbetçi sayısı **Tip B'den sayılır**, yazılı değildir |
| **H4 (yeni)** — `×` = **o gün nöbet işareti**; NÖBET kolonu = **nöbet gününün kodu** (nöbet sırasında geçerli hat kodu) | (a) G15'in `×` kümesi ile G14'ün **dolu** NÖBET hücreleri kümesi karşılaştırıldı; (b) 41 satırda NÖBET değeri ↔ `×` yanındaki kod | **KABUL — ONAYLANDI (2026-10-27): kod = hat kodu.** (a) Varlık/yokluk eşleşmesi **41/41 (%100)**: `×` olan 34 plakanın hepsinde NÖBET dolu, `×` olmayan 7 plakada (130, 166, 184, 208, 253, 285, 286) NÖBET **boş**. (b) Kod eşleşmesi **33/33 (%100)** |

#### Kanıt tablosu A — H1 testi (G15 `×` sayısı ↔ G14 NÖBET)

G15 kolon kırpmalarından sayılan `×` adetleri; G14 değerleri aynı satırdan okundu.

| Plaka | G15 `×` sayısı | G14 `NÖBET` | H1 tutuyor mu |
| --- | --- | --- | --- |
| 003 | 1 (PAZARTESİ) | 5 | ✗ |
| 030 | 1 (PAZAR) | 4 | ✗ |
| 050 | 1 (CUMARTESİ) | 2 | ✗ |
| 053 | 1 (ÇARŞAMBA) | 6 | ✗ |
| 060 | 1 (PAZAR) | 20 | ✗ |
| 080 | 1 (ÇARŞAMBA) | 6 | ✗ |
| 085 | 1 (PAZARTESİ) | 5 | ✗ |
| 128 | 1 (PAZARTESİ) | 5 | ✗ |
| 159 | 1 (ÇARŞAMBA) | 6 | ✗ |
| 190 | 1 (ÇARŞAMBA) | 6 | ✗ |
| 226 | 1 (PAZAR) | 4 | ✗ |
| 271 | 1 (ÇARŞAMBA) | 6 | ✗ |
| 130 | 0 | (boş) | ✗ (0 ≠ boş; yalnızca "nöbet yok" anlamında tutarlı) |
| 166 | 0 | (boş) | ✗ (aynı) |
| **Toplam** | 14 plaka | — | **0/14 sayısal eşleşme** |

Tam liste (41 plaka) üzerinden: **sayısal eşleşme 0/41 = %0**, **varlık/yokluk eşleşmesi 41/41 = %100**.

#### Kanıt tablosu B — H4 testi (G14 nöbet günü ve kodu ↔ NÖBET kolonu)

| Plaka | Nöbet günü (G14 satırı) | Hücredeki yazım | G14 `NÖBET` | Eşleşme |
| --- | --- | --- | --- | --- |
| 003 | PAZARTESİ | `×5` | 5 | ✓ |
| 030 | PAZAR | `4×` | 4 | ✓ |
| 050 | CUMARTESİ | `×2` | 2 | ✓ |
| 053 | ÇARŞAMBA | `×6` | 6 | ✓ |
| 060 | PAZAR | `×20×` | 20 | ✓ |
| 080 | ÇARŞAMBA | `6×` | 6 | ✓ |
| 085 | PAZARTESİ | `5×` | 5 | ✓ |
| 100 | PAZAR (şüpheli: CMT sınırı) | `2⊗` | 2 | ✓ |
| 128 | PAZARTESİ (şüpheli: SALI sınırı) | `×5` | 5 | ✓ |
| 146 | PAZARTESİ | `5×` | 5 | ✓ |
| 153 | CUMARTESİ | `×2` | 2 | ✓ |
| 159 | ÇARŞAMBA | `6⊗` | 6 | ✓ |
| 176 | CUMARTESİ | `⊗2` | 2 | ✓ |
| 200 | PAZARTESİ | `5⊗` | 5 | ✓ |
| 203 | ÇARŞAMBA | `6⊗` | 6 | ✓ |
| 226 | PAZAR | `4⊗` | 4 | ✓ |
| 229 | CUMARTESİ | `2⊗` | 2 | ✓ |
| 272 | PAZAR (şüpheli: CMT sınırı) | `2⊗` | 2 | ✓ |
| 284 | PAZAR | `4⊗` | 4 | ✓ |
| 130 | — | `×` yok | (boş) | ✓ |
| 166 | — | `×` yok | (boş) | ✓ |
| 184 | — | `×` yok | (boş) | ✓ |
| 208 | — | satır tamamen çapraz taranmış (araç devre dışı) | (boş) | ✓ |
| 253 | — | `×` yok (SALI'de başıboş bir `⊗`, şüpheli) | (boş) | ✓ |
| 285 | — | `×` yok | (boş) | ✓ |
| 286 | — | `×` yok | (boş) | ✓ |

`⊗` = daire içine alınmış `×`. Kodun `×`'in soluna ya da sağına yazılması serbesttir (`×5` ve `5×` aynı anlamda kullanılmış).

#### G15 gün kolonlarındaki `×` dağılımı (21.09–27.09.2026)

| Gün | `×` sayısı | `×` konan plakalar (sol alt kolon / sağ alt kolon) |
| --- | --- | --- |
| PAZARTESİ | 8 | 085, 125, 146, 200 / 003, 160, 128, 086 |
| SALI | 0 | — |
| ÇARŞAMBA | 10 | 080, 277, 271, 159, 203 / 260, 053, 251, 190, 235 |
| PERŞEMBE | 0 | — (bu kolon siyah kalemle ve daire içi sıra numaralarıyla yazılmış; `×` yok) |
| CUMA | 0 | — |
| CUMARTESİ | 8 | 272, 229, 100, 205 / 153, 176, 050, 198 |
| PAZAR | 8 | 188, 284, 129, 147, 226, 030, 042 / 060 |
| **Toplam** | **34** | 34 farklı plaka; hiçbir plaka iki günde `×` almamış |

**İşaretin konumu:** her gün kolonu iki alt kolona bölünmüş (sol/sağ); `×` **plaka numarasının hemen önünde, aynı hücrenin içinde**, kırmızı/mavi kalemle ve küçük boyutta yazılmış (`× 85`, `× 125`). `×` grubu her gün listesinin **sonunda** yer alıyor: ondan sonra `YAT` ayırıcısı ve yatan araçlar geliyor. Yani `×` ayrı bir kolon değil, plaka hücresinin içine düşülmüş bir işaret; Tip A'da ise kodun yanına (`×5` / `5×`) düşülüyor.

**Çapraz doğrulama (G01, 26.10–01.11):** G01 kolon kırpımlarında `×` sayıları: PAZARTESİ **8** (146, 272, 226, 129 / 60, 128, 176, 260), SALI **8** (188, 159, 203, 042, 125, 166, 198 + `70` şüpheli), CUMA **10** (229, 277, 200, 147, 253 / 160, 153, 86, 50, 03); CUMARTESİ ve PAZAR'da `×` yok. Bu plakaların G02'deki NÖBET değerleri 2, 6, 6, 4, 5, 4, 5 … — yine **hiçbiri `×` sayısına eşit değil**, yani H1 ikinci haftada da düşüyor. Nöbet günleri bu kez PAZARTESİ/SALI/ÇARŞAMBA/CUMA'ya düşüyor (CUMARTESİ/PAZAR'da `×` yok) → **nöbet günü haftadan haftaya kayıyor**.

#### Sonuç

**H1, H2 ve H3 reddedildi; NÖBET bir sayım değildir.** NÖBET kolonu, plakanın **nöbet gününü** ve o gün geçerli **kodu** taşır: `×` işareti nöbet gününü işaretler, NÖBET hücresi o günün kodunu (**hat kodu** — ONAYLANDI 2026-10-27: 2, 4, 5, 6; bir kez 20) tekrarlar; nöbet günü yoksa hücre boştur. Eşleşme: varlık/yokluk **%100 (41/41)**, kod **%100 (33/33)**, H1 sayısal **%0 (0/41)**.

**ONAYLANDI (2026-10-27): kod = hat kodu.** NÖBET kolonundaki değer, o gün nöbetçi aracın uyguladığı **hat kodu**dur; değerler tek/ift haneli hat numaralarıdır (`2`, `4`, `5`, `6`, `20`) ve O1 (tek rakam = hat numarası) ile tutarlıdır — 060'ın iki ayrı ayda `20` ve `2` değerleri iki farklı hattın nöbetidir, haftalık/aylık sayım değildir.

**Kalan tek belirsizlik:** bazı satırlarda `×` hücre sınırına yazıldığı için **gün ataması** şüpheli (ÇARŞAMBA↔PERŞEMBE ve CUMARTESİ↔PAZAR komşuluğu; tabloda "şüpheli" işaretli 3 satır + 190, 235, 251, 260, 277 için gün ÇARŞAMBA'ya çekildi) — pilot hafta elle karşılaştırması ile teyit edilecek.

**Yan bulgu (G14):** tablo altındaki `= 71` doğrulandı — gün sütunları 7 + 3 + 7 + 5 + 10 + 18 + 21 = **71**. §4'teki "G14 `=71`?" şüphesi kapandı.

---

## 5) Filoyu oluşturan plakalar

Görsellerden okunabilen tüm plaka numaraları (tekrarsız). Numara, plakanın son 3 hanesidir (`43 XXX` biçiminin kısaltması — hipotez: Kütahya il kodu 43).

| # | Plaka |
| --- | --- |
| 1 | 003 |
| 2 | 030 |
| 3 | 042 |
| 4 | 050 |
| 5 | 053 |
| 6 | 060 |
| 7 | 080 |
| 8 | 085 |
| 9 | 086 |
| 10 | 100 |
| 11 | 125 |
| 12 | 128 |
| 13 | 129 |
| 14 | 130 |
| 15 | 134 |
| 16 | 146 |
| 17 | 147 |
| 18 | 153 |
| 19 | 159 |
| 20 | 160 |
| 21 | 166 |
| 22 | 176 |
| 23 | 184 |
| 24 | 186 |
| 25 | 188 |
| 26 | 190 |
| 27 | 198 |
| 28 | 200 |
| 29 | 203 |
| 30 | 205 |
| 31 | 208 |
| 32 | 221 |
| 33 | 225 |
| 34 | 226 |
| 35 | 229 |
| 36 | 235 |
| 37 | 251 |
| 38 | 253 |
| 39 | 260 |
| 40 | 271 |
| 41 | 272 |
| 42 | 277 |
| 43 | 284 |
| 44 | 285 |
| 45 | 286 |

Toplam: **45 farklı numara**. Bunların 41'i her tabloda sabit kolon olarak basılı; kalan 4'ü (**134, 186, 225, 229**) G02'de elle yazılmıştır (kolon başlıkları: `229` mavi kalemle, `225` mavi, `134` mavi, `186` mavi). G02'de `221` ve `085` basılıdır: `221`'in üzerine `229`, `085`'in üzerine `225` yazılmıştır; ikisi de filoda kalır (O5, 2026-10-27). Yani **basılı taban liste 41**, elle yazılan 4 numara var; toplam 45. Not: G03/G05/G13/G16/G21'in basılı kolon başlıklarında `229` vardır, `221` yoktur (bkz. §2); kaynak ayrımı `arac.kaynak` alanıyla tutulur (docs/03 TD-36).

Sabit (her görselde basılı) 41'li liste — G03, G05, G13, G16, G21 kolon başlıklarından:

`003, 030, 042, 050, 053, 060, 080, 085, 086, 100, 125, 128, 129, 130, 146, 147, 153, 159, 160, 166, 176, 184, 188, 190, 198, 200, 203, 205, 208, 226, 229, 235, 251, 253, 260, 271, 272, 277, 284, 285, 286`

Şüpheli/okunamayan: `080` (bazı görsellerde elle `080` üzerine yazılmış), `085` (G02'de üzerine `225` yazılı), `221` (G02'de üzerine `229` yazılı) → §9 soru 6–7.

### 5.1 Elle yazılan plaka belirsizliği (S6/S7) — ONAYLANDI (2026-10-27)

G02 görselinde iki kolon başlığı elle yazılmıştır: **satır 2** (`221` basılı, üzerine `229` yazılı) ve **satır 9** (`085` basılı, üzerine `225` yazılı).

**ONAYLANDI (2026-10-27): 45 plaka, elle yazılan 229/225 geçerli ek kayıt.** Elle yazılanlar `134, 186, 225, 229`; basılı olanlar `085` ve `221` (`221` basılı, üzerine `229` yazılmış; `085` basılı, üzerine `225` yazılmış). İkisi de filoda kalır; ayrım `arac.kaynak` (`basili`/`elle`) ile tutulur (bkz. docs/03 TD-36).

---

## 6) Haftalar arası rotasyon

### 6.1 Görünen kural: görev grubu her hafta **bir gün öne** kayıyor

Tip B tabakalarının kolon üstü el yazısı notları, aynı görev grubunun haftalar boyunca kaydığını gösteriyor. En net örnek `(6) Toki` grubu:

| Hafta | Gün | Görsel |
| --- | --- | --- |
| 14.09 – 20.09 | PERŞEMBE | G17 |
| 21.09 – 27.09 | ÇARŞAMBA | G15 |
| 28.09 – 04.10 | SALI | G11 |
| 05.10 – 11.10 | PAZARTESİ | G09 (ve G07) |
| 12.10 – 18.10 | PAZAR | G06 |
| 19.10 – 25.10 | CUMARTESİ | G04 |
| 26.10 – 01.11 | CUMA | G01 |

Aynı desen diğer gruplarda da tekrarlıyor:

| Grup | 21.09 (G15) | 28.09 (G11) | 05.10 (G09) | 12.10 (G06) | 19.10 (G04) | 26.10 (G01) |
| --- | --- | --- | --- | --- | --- | --- |
| `(2) F.Şelebi` | CUMARTESİ | CUMA | PERŞEMBE | ÇARŞAMBA | SALI | PAZARTESİ |
| `(5) B.Evler` / `(5) B.Çukur` (aynı grup olabilir) | PAZARTESİ | PAZAR | CUMARTESİ | CUMA | PERŞEMBE | ÇARŞAMBA |
| `(1) Kampüs/Konya` | CUMA | PERŞEMBE | ÇARŞAMBA | SALI | PAZARTESİ | PAZAR |
| `(6) Toki` | ÇARŞAMBA | SALI | PAZARTESİ | PAZAR | CUMARTESİ | CUMA |

**Kural (kullanıcı onayı O4 ile resmi):** plan 7 haftalık bir döngüdür; her hafta görev grubu–gün eşleşmesi bir gün geriye (takvimde öne) kayar, 7 haftada tam tur atar. Yani bir aracın/görevin hangi güne düştüğü `(hafta_no mod 7)` ile belirlenebilir.

Not: aynı grubun adı tabakalarda farklı yazılmış (`B.Evler` / `B.Çukur` / `S.B.Çukur`, `Kampüs` / `Konya`); parantez içi sayı (1, 2, 5, 6) sabit kaldığı için bunlar aynı grubun okuma varyantı sayıldı → §9 soru 12.

### 6.2 Araç bazında kayma (hipotez)

Araç bazında kayma, plaka listelerinin sıralı olması nedeniyle **listenin kayması** biçiminde görünüyor:

- G09 Pazartesi listesi: `188, 286, 205, 271, 277, 285, 272, 203, 146, 80, 226, 30 …`
- G04 Pazartesi listesi: `129, 286, 146, 284, 147, 253, 271, 030, 188, 30, 285, 125, 277, 42, 272, 229, 226, 205 …`
- G01 Pazartesi listesi: `30, 42, 50, 53, 86, 160, 166, 184, 198, 205, 226, 251, 260, 285 …`

Üç listede de `286, 271, 272, 226, 205, 188` gibi çekirdek plakalar var; sıra ve komşuluk değişiyor. Bu, "aynı havuz, her hafta farklı sıra" (rotasyon) okumasını destekliyor. Kesin plaka→gün eşlemesi için tabloların tam sayısallaştırılması gerekir → §9 soru 9.

---

## 7) Elle yapılan düzeltmelerin tipolojisi

| Tip | Görsel örnek | Ne yapılmış | Planlama kuralına işaret ediyor mu |
| --- | --- | --- | --- |
| Üstü çizme | G02, G03, G08, G16, G21 (`×253`, `×229`, `×125`, `×200`) | Plaka veya kodun üstü çizilerek **iptal** (hücreye tek başına yazılan `x` bundan ayrıdır: `x` = nöbet, O3) | Evet: araç o gün/seferde görevden çıkarılmış |
| Kırmızı daire / elips | G02, G03, G05, G08, G16 (`(-20)` kırmızı elips) | Kodun etrafı kırmızı kalemle çevrilmiş | Evet: dikkat çekilen/onaylanan özel görev (gece/ek sefer) |
| Yeşil / mavi / mor daire | G02 (`7` yeşil, `3` mavi), G21 (`9A` mavi) | Aynı sayıların farklı renklerde daire içine alınması | Hipotez: renk = vardiya veya görev grubu kodu |
| Kırmızı çapraz tarama | G08, G13, G14, G16, G21 (kolon/satır bandı) | Kolon veya satırın tamamen çapraz çizilmesi | Evet: **kolon iptali** (araç veya gün devre dışı) |
| Fosforlu kalem (pembe/turuncu) | G03 (`030`, `198`), G21 (`198`, `200`, `203`), G05 (`203`) | Kolon/satır vurgusu | Hipotez: yeni eklenen / değişen araç |
| Ok işareti | G08 (kolon üzerinde kırmızı ok, `205 → 208` bölgesi) | Bir kolondan diğerine yönlendirme | Evet: görev aktarımı (araç değişimi) |
| Yer/kişi notu | G03, G04, G06, G11, G15, G17, G18, G21 (`otogar`, `Demirci`, `Toli/Toki`, `toplam`) | Hücre kenarına el yazısı | Evet: sefer noktası / sürücü / servis bilgisi |
| Kolon başlığı üstü yazı | G02 (`229`, `225`, `134`, `186` mavi) | Basılı plakanın üzerine yeni plaka | Evet: **araç değişimi** (filo güncellemesi) |
| Daire içi sıra sayıları | G07, G09, G11, G15 (`(12)…(27)`) | Sıra numarası ekleme | Evet: rotasyon sırası / sefer no |

**Yorum:** düzeltmeler rastgele değil; üç ana nedene bağlı görünüyor: (a) araç devre dışı (arıza/bakım), (b) araç değişimi (plaka ikamesi), (c) ek/özel görev (gece, otogar, servis). Bu üçü uygulamada birer **istisna kaydı** olarak modellenmeli.

---

## 8) Önerilen normalize veri modeli

| Varlık | Alanlar | İlişki |
| --- | --- | --- |
| **Arac** | `arac_id` (PK), `plaka` (43 XXX, unique), `filo_no` (003, 030…), `tip` (körüklü/solo — hipotez), `aktif` (bool), `gorsel_ref` | 1-N `Atama`, 1-N `Nobet` |
| **Hat** | `hat_id` (PK), `hat_kodu` (`7A`, `9A`, `9AT`, `1A`, `A1`…), `hat_no` (sayısal kısım), `varyant` (A/B/E/T/S), `ad` (hipotez: Toki, Kampüs, B.Çukur), `aktif` | 1-N `Sefer`, 1-N `Atama` |
| **Sefer** | `sefer_id` (PK), `hat_id` (FK), `baslangic_saat`, `bitis_saat`, `gun_tipi` (hafta içi/cmt/paz), `sure_dk`, `yon` (gidiş/dönüş — hipotez) | N-1 `Hat`, 1-N `Atama` |
| **Gun** | `gun_id` (PK), `tarih`, `gun_adi` (PAZARTESİ…PAZAR), `hafta_id` (FK), `gun_tipi` | N-1 `Hafta`, 1-N `Atama` |
| **Hafta** | `hafta_id` (PK), `baslangic` (Pzt), `bitis` (Paz), `sezon`, `döngü_sırası` (1–7), `toplam_arac_gun` (`=76`, `=101`) | 1-N `Gun` |
| **Atama** | `atama_id` (PK), `hafta_id`, `gun_id`, `arac_id`, `hat_id`, `sefer_id` (nullable), `vardiya` (`A`/`S`/`-`), `sefer_sayisi`, `durum` (`gorevli` / `YAT` / `iptal`), `gorev_grubu` (`2. Töre`, `Toki`…), `kaynak_gorsel` (`G09`), `elle_duzeltme` (bool) | N-1 `Arac`, `Gun`, `Hat`, `Sefer` |
| **Nobet** | `nobet_id` (PK), `tarih`, `arac_id`, `tip` (`gece`/`nobet`), `sayi` (hücredeki `5`, `6`), `kaynak_gorsel` | N-1 `Arac` |
| **GorevGrubu** | `grup_id` (PK), `ad` (`2. Töre`, `Toki`, `F.Şelebi`, `B.Çukur`, `Kampüs`, `B.Evler`), `arac_sayisi` (parantez içi sayı), `sorumlu` (hipotez) | 1-N `Atama` |
| **Duzeltme** | `duzeltme_id` (PK), `atama_id` (FK, nullable), `tur` (`ustu_cizme`/`daire`/`ok`/`not`/`fosforlu`/`tarama`), `eski_deger`, `yeni_deger`, `gorsel_ref`, `tarih` | N-1 `Atama` |
| **GorselKaynak** | `gorsel_id` (PK, `G01`…`G21`), `dosya_adi`, `tablo_tipi` (`A`/`B`), `hafta_id`, `okunabilirlik`, `mukerrer_mi` | 1-N `Atama`, `Duzeltme` |

**İlişki özeti:** `Hafta 1-N Gun 1-N Atama N-1 Arac`; `Atama N-1 Hat 1-N Sefer`; `Arac 1-N Nobet`; `GorevGrubu 1-N Atama`; `Duzeltme` atamaya opsiyonel bağlanır (elle yapılan istisnalar kaybolmasın).

**Tasarım notu:** `YAT` bir durum değeri olarak `Atama.durum` içinde tutulmalı; ayrı tablo açmak gereksiz (YAT satırları sadece "o gün görev yok" demek).

---

## 9) Açık sorular

1. **Tek rakam kodları (`2`, `5`, `6`, `7`) ne anlama geliyor?** Sefer sayısı mı, hat numarası mı? (G08 Pazartesi satırında hücrelerin çoğu aynı değeri taşıyor; G21 aynı satırda `7A/9A/S/15` gibi çeşitli kodlar taşıyor.) → **Kapandı (O1, 2026-10-27): hat numarası.**
2. **`9AT` kodundaki `T` nedir?** "Töre" mi, "tam gün" mü, "takviye" mi? (G01, G03, G05, G21)
3. **`A1` ile `1A` aynı şey mi?** Biri vardiya+sefer, diğeri hat kodu mu? (G02, G13, G16, G21)
4. **Günlük araç sayısı (8, 4, 20, 20 …) gerçekten araç sayısı mı?** Hafta sonu sayıların hafta içinden yüksek olması beklenen bir durum mu, yoksa bu sayı "görev/sefer sayısı" mı? (G02, G16)
5. **Okunamayan toplamlar:** G03 (`=66`), G05 (`=65`), G08 (`=66`), G14 (`=71`), G21 (`=126`), G13 (`=66`) — bu toplamlar günlük sayıların toplamıyla uyuşmuyor; hangisi doğru, hangi gün hücresi yanlış sayıldı?
6. **`221` mi `229` mu?** G02'de 2. kolonun basılı değeri `221`, üzerine mavi kalemle `229` yazılmış. Filoda hangi plaka var? (G02)
7. **`085` mi `225` mi?** G02'de 9. kolon `085` basılı, üzerine `225` yazılmış; G03/G05/G13'te `085` basılı. Hangisi doğru? (G02, G03)
8. **`080` neden elle yazılmış?** Bazı tabakalarda `080` basılı, bazılarında elle yazılmış (G03, G05). Filoya sonradan mı eklendi?
9. **Plaka→gün eşlemesi birebir nasıl doğrulanır?** Aynı haftanın matrisi (G08) ve rotasyonu (G09) aynı bilgiyi mi taşıyor, yoksa biri "görev", diğeri "sıra" mı? Hangi kaynak doğru kabul edilmeli? → **Kapandı (O2, 2026-10-27): esas kaynak Tip B.**
10. **`NÖBET` satırındaki sayı (5, 6, 2) ne?** Aylık nöbet sayısı mı, nöbet günü mü, nöbetçi araç sayısı mı? (G02, G03, G16) → **ONAYLANDI (2026-10-27): hücredeki `x` = nöbet günü (O3), bu satırdaki sayı = hat kodu.** Durum (2026-10-27): sayı bir **sayım değil**, o plakanın nöbet günündeki **hat kodu**dur (`×` yanındaki kod; haftalık/aylık nöbet gün sayısı ve günlük nöbetçi sayısı hipotezleri reddedildi; varlık eşleşmesi 41/41, kod eşleşmesi 33/33) — **ONAYLANDI (2026-10-27): kod = hat kodu**; ayrıntı §4.1.
11. **`YAT` bloğu kuralı nedir?** Yatan araçlar rotasyona göre mi belirleniyor, yoksa arıza/bakım listesine göre mi? (G09, G04, G15)
12. **`2. Töre` nedir?** Bir hat adı mı, bir görev grubu mu, bir sürücü/servis adı mı? Parantez içi sayı araç sayısı mı? (G04, G06, G11, G15, G17)
13. **`otogar`, `Demirci`, `Toli/Toki` notları ne?** Sefer noktası mı, sürücü adı mı, servis bölgesi mi? (G03, G11, G15, G18)
14. **`-20`, `-13`, `-108` gibi eksi kodlar ne?** "20 hattına ek görev" mi, saat (20:00) mi, negatif düzeltme mi? (G02, G03, G05, G13, G21) → **ONAYLANDI (2026-11-01, S14): negatif kod = ek görev (-20 => 20 hattına ilave görev); ham kod `gorev_kodu_ham`'da saklanır, normalize edilirken hat numarası çıkarılır ve ek görev olarak işaretlenir.**
15. **`12.00`, `13.00`, `14.00`, `20.30` saat mi?** Saat ise sefer başlangıcı mı, vardiya bitişi mi? (G16, G03) → **ONAYLANDI (2026-11-01, S15): değer sefer başlangıç saatidir (örn. 12.00 = 12:00); o aracın o günkü ilk seferi.**
16. **Kolon üstündeki `(4) (20)` / `(8) (10)` / `(7A) (9)` çiftleri ne?** O gün çalışan iki hat mı, iki vardiya mı? (G07, G09, G15, G17)
17. **`12G` / `12P` ne?** Gündüz/pik ayrımı mı, personel sayısı mı? (G16)
18. **Hafta sonu tarifesi neden farklı?** Cumartesi/Pazar 20+ araç, hafta içi 4–8 araç: bu gerçek mi, yoksa hafta içi tabloları eksik mi doldurulmuş? (G02 vs G16)
19. **Başlıksız iki matris (G13, G16) hangi haftalara ait?** 28.09 ve 14.09 çıkarımı doğru mu? (G13, G16)
20. **7 haftalık döngü kuralı doğru mu?** Görev grubu her hafta bir gün kayıyor gözlemi (G17→G15→G11→G09→G06→G04→G01) resmi bir rotasyon kuralı mı, yoksa planlayıcının alışkanlığı mı? → **Kapandı (O4, 2026-10-27): resmi kural.**

---

## 10) Uygulama için çıkarımlar

| Bilgi | Kaynağı | Excel'e girilmeli mi, hesaplanmalı mı |
| --- | --- | --- |
| Plaka listesi (41 sabit + 4 değişken) | G02, G03, G05, G13, G16, G21 kolon başlıkları | **Girilmeli** (Arac sayfası, elle) |
| Hat kodları sözlüğü (`7A`, `9A`, `9AT`, `1A`…) | Tüm görseller | **Girilmeli** (Hat sayfası, elle — anlamları §0 onaylarına göre; `5x` hat kodu değil, hat 5 + nöbet işaretidir: O3) |
| Hafta tarihleri (Pzt–Paz) | Görsel başlıkları | **Girilmeli** (Hafta sayfası) |
| Gün bazlı atama (plaka + kod) | Tip A hücreleri | **Girilmeli** (Atama sayfası, ana veri) |
| Rotasyon listesi (gün → sıralı plaka) | Tip B kolonları | **Girilmeli** (Atama sayfası, sıra_no alanı ile) |
| `YAT` listesi | Tip B YAT blokları | **Girilmeli** (durum = YAT) |
| Nöbet satırı | Tip A üst satır | **Girilmeli** (Nobet sayfası) |
| Görev grubu notları (`2. Töre (6) Toki`) | Tip B kolon üstü | **Girilmeli** (GorevGrubu sayfası) |
| Elle düzeltmeler (üstü çizme, daire, ok) | Tüm görseller | **Girilmeli** (Duzeltme sayfası — denetim izi) |
| Günlük araç sayısı | Tip A sağ kolon | **Hesaplanmalı** (Atama sayımı) |
| Haftalık toplam (`=76`) | Tip A sağ üst | **Hesaplanmalı** (günlük sayıların toplamı) |
| Hat başına araç/sefer sayısı | Atama + Hat | **Hesaplanmalı** |
| Bir sonraki haftanın rotasyonu | 7 haftalık kayma kuralı | **Hesaplanmalı** (döngü formülü) — O4 (2026-10-27) ile resmi kural |
| Çakışma kontrolü (aynı araç iki görevde) | Atama | **Hesaplanmalı** |
| Nöbet dağılım dengesi | Nobet + Arac | **Hesaplanmalı** |
| `YAT`/izin/arıza gerekçeleri | Görsellerde yok | **Girilmeli** (yeni alan, kullanıcıdan bilgi gerekli) |

**Uygulama sırası önerisi:** (1) Arac + Hat sözlüklerini kullanıcıyla netleştir (§9/1–3, 6–7), (2) bir haftayı (G09 + G08) pilot olarak Excel'e gir, (3) günlük sayımı ve toplamı hesapla, tablodaki `=76` ile karşılaştır, (4) 7 haftalık kayma kuralını pilot haftalarla test et, (5) sonra kalan 7 haftayı içe aktar.

---

### Ek: yöntem ve sınırlar

- 21 görselin tamamı açıldı; 90° döndürülmüş kopyalar `/tmp/bus/r01.png … r21.png` altında üretildi (orijinaller değişmedi).
- El yazısı tanıma görsel yorumla yapıldı; sayısal alanlarda ±1 hata payı vardır. Şüpheli hücreler metinde `?` veya "şüpheli" olarak işaretlendi.
- Bu belge **kod içermez**; sadece alan analizi ve veri modeli önerisidir.
