// City Bus Ops landing site — two jobs: the TR/EN switch and the responsive header.
// Everything else is static: content renders without this file, in Turkish.

const STORAGE_KEY = 'cbo-site-lang';
const LOCALES = ['tr', 'en'];

const TITLES = {
  tr: 'City Bus Ops — belediye otobüs filosu için görev planlama',
  en: 'City Bus Ops — duty planning for a municipal bus fleet',
};

const DESCRIPTIONS = {
  tr: 'Araç bloklama, şoför görevleri ve 7 haftalık rotasyon kanunu: çevrimdışı çalışan Windows masaüstü uygulaması. TypeScript, Electron, gömülü SQLite, GTFS/TODS ve Excel çıktısı.',
  en: 'Vehicle blocking, driver duties and the 7-week rotation law for a municipal bus fleet. Offline Windows desktop app: TypeScript, Electron, embedded SQLite, GTFS/TODS and Excel output.',
};

/* ------------------------------------------------------------------- i18n */

function storedLocale() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function requestedLocale() {
  const fromQuery = new URLSearchParams(location.search).get('lang');
  if (LOCALES.includes(fromQuery)) return fromQuery;
  return storedLocale();
}

function rememberLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // storage can be blocked; the switch still works for this page view
  }
}

function applyLocale(locale) {
  const html = document.documentElement;
  html.lang = locale;
  html.dataset.lang = locale;
  document.title = TITLES[locale];

  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', DESCRIPTIONS[locale]);

  for (const input of document.querySelectorAll('input[name="lang"]')) {
    input.checked = input.value === locale;
  }
}

const initialLocale = requestedLocale() ?? 'tr';
applyLocale(initialLocale);
rememberLocale(initialLocale);

document.querySelector('.lang-switch')?.addEventListener('change', (event) => {
  const { value } = event.target;
  if (!LOCALES.includes(value)) return;
  applyLocale(value);
  rememberLocale(value);
  // the header row width depends on the active locale, so the layout is re-measured
  measureHeader({ force: true });
});

/* ----------------------------------------------------------------- header */

const header = document.querySelector('.site-header');
const inner = header?.querySelector('.header-inner');
const menu = header?.querySelector('#site-menu');

let isWide = null;
let lastWidth = 0;

function applyLayout(wide) {
  if (!header || !menu) return;
  const wasOpen = menu.matches(':popover-open');
  isWide = wide;
  header.classList.toggle('is-wide', wide);
  if (wide) menu.removeAttribute('popover');
  else menu.setAttribute('popover', 'auto');
  if (!wide && wasOpen) menu.showPopover();
}

// Measure the inline row, then fall back to the popover only when it does not fit.
// No hard-coded breakpoint: a longer translation or larger text moves the point itself.
function measureHeader({ force = false } = {}) {
  if (!header || !inner) return;
  const width = inner.clientWidth;
  if (!force && isWide === false && width <= lastWidth) return;
  lastWidth = width;

  header.classList.add('is-measuring');
  applyLayout(true);
  const fits = inner.scrollWidth <= inner.clientWidth + 1;
  applyLayout(fits);
  requestAnimationFrame(() => header.classList.remove('is-measuring'));
}

if (header && inner && menu) {
  measureHeader({ force: true });

  const observer = new ResizeObserver(() => measureHeader());
  observer.observe(inner);
  observer.observe(menu);

  // font loading and text zoom change the natural width without a resize
  document.fonts?.ready.then(() => measureHeader({ force: true }));

  // closing the popover menu after a jump keeps the target visible instead of covered
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a') && !isWide && menu.matches(':popover-open')) menu.hidePopover();
  });
}
