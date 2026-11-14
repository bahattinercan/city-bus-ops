# City Bus Ops — landing site

Static, dependency-free single-page site for the product: `site/`. No build step, no framework,
no npm package. It is deployed to GitHub Pages by `.github/workflows/pages.yml`, which uploads the
folder as-is.

## English

### Layout

```
site/
  index.html      the whole page, one file
  styles.css      planetary-service tokens + layout (the same visual language as the app)
  app.js          TR/EN switch and the responsive header, nothing else
  favicon.svg     mark: orbit ring + accent dot
  assets/         screenshots copied from docs/screenshots (hero-tr, hero-en, plan, assistant, guide)
```

Text lives in the HTML, twice: every translatable node is a pair of
`<span data-lang="tr">…</span><span data-lang="en">…</span>` inside the same element. Turkish is the
markup default; `app.js` only flips `data-lang` on `<html>`, so the page is complete and readable
with JavaScript disabled. Adding a sentence means adding it to both pairs — there is no dictionary
file and no build-time key check here, the review is the check.

### Preview and verify

```bash
python -m http.server 4173 -d site        # then open http://127.0.0.1:4173/
node scripts/site-probe.mjs               # expects the server above; browser via BROWSER_PATH
```

`scripts/site-probe.mjs` drives headless Chrome over CDP and asserts what the design cannot show by
itself: the default locale, the EN switch (real mouse click) and its persistence across a reload,
every image loading after the scroll, no horizontal overflow, the collapsed header opening its
popover menu, Escape closing it, a menu link landing below the sticky header, and zero console
errors. Screenshots land in `.design-audit/probe/` (git-ignored).

Layout and accessibility measurements (horizontal overflow, contrast, touch targets, 320px reflow,
200% zoom, axe) come from the `web-design-breakage-audit` skill:

```bash
node ~/.pi/agent/pi-hermes-memory/skills/web-design-breakage-audit/scripts/design-audit.mjs site/index.html -o .design-audit --deep --axe
```

### Rules

- Colours, radii, spacing, fonts and durations come from `:root` in `styles.css`; no literal inside a
  rule. That block mirrors the app's `[data-style='planetary-service']` tokens.
- Nothing is hard-coded about the download: version, file names, sizes and SHA-256 in the page must
  match the release assets. Bumping a version means editing `index.html` in both language pairs.
- The binaries are unsigned, and the page says so in both languages. Do not drop that notice when
  the site is copied elsewhere.
- The header measures the inline row in script and collapses to a popover only when it does not fit
  (`measureHeader()`), so a longer translation moves the breakpoint by itself. Do not add a
  hard-coded breakpoint for the navigation.

## Türkçe

### Düzen

```
site/
  index.html      sayfanın tamamı, tek dosya
  styles.css      planetary-service token'ları + yerleşim (uygulamayla aynı görsel dil)
  app.js          TR/EN anahtarı ve duyarlı başlık; başka iş yapmaz
  favicon.svg     işaret: yörünge halkası + vurgu noktası
  assets/         docs/screenshots'tan kopyalanan ekran görüntüleri
```

Metin HTML'de iki kez durur: çevrilecek her düğüm aynı elemanın içinde
`<span data-lang="tr">…</span><span data-lang="en">…</span>` çiftidir. Varsayılan Türkçedir;
`app.js` yalnızca `<html>` üzerindeki `data-lang` değerini değiştirir, yani JavaScript kapalıyken de
sayfa eksiksiz okunur. Yeni bir cümle eklemek iki çifti birlikte düzenlemek demektir — burada sözlük
dosyası ve derleme zamanı anahtar denetimi yok; denetim gözden geçirmedir.

### Önizleme ve doğrulama

```bash
python -m http.server 4173 -d site        # sonra http://127.0.0.1:4173/ aç
node scripts/site-probe.mjs               # yukarıdaki sunucuyu bekler; tarayıcı BROWSER_PATH ile
```

`scripts/site-probe.mjs` CDP üzerinden başsız Chrome sürer ve tasarımın tek başına gösteremediğini
ölçer: varsayılan dil, EN anahtarı (gerçek fare tıklaması) ve yenilemeden sonra kalıcılığı, kaydırma
sonrası tüm görsellerin yüklenmesi, yatay taşma olmaması, dar başlığın popover menüsünü açması,
Escape'in kapatması, menü bağlantısının sabit başlığın altına inmesi ve konsolda sıfır hata. Ekran
görüntüleri `.design-audit/probe/` altına yazılır (git tarafından yok sayılır).

Yerleşim ve erişilebilirlik ölçümleri (yatay taşma, kontrast, dokunma hedefi, 320px reflow, %200
zoom, axe) `web-design-breakage-audit` skill'inden gelir:

```bash
node ~/.pi/agent/pi-hermes-memory/skills/web-design-breakage-audit/scripts/design-audit.mjs site/index.html -o .design-audit --deep --axe
```

### Kurallar

- Renk, yarıçap, boşluk, font ve süre `styles.css` içindeki `:root` bloğundan gelir; kural içinde
  literal yazılmaz. Blok, uygulamanın `[data-style='planetary-service']` token'larını yansıtır.
- İndirme bilgisi uydurulmaz: sayfadaki sürüm, dosya adları, boyutlar ve SHA-256 release asset'leriyle
  aynı olmalı. Sürüm yükseltmek `index.html` içindeki iki dil çiftini birlikte düzenlemek demektir.
- Dosyalar imzasızdır ve sayfa bunu iki dilde yazar. Site başka yere kopyalanırken bu uyarı silinmez.
- Başlık, satır içi genişliği betikle ölçer ve ancak sığmadığında popover'a düşer
  (`measureHeader()`); uzun bir çeviri kırılım noktasını kendisi kaydırır. Navigasyon için sabit
  breakpoint eklenmez.
