// Interaction probe for site/index.html: language switch, popover menu, images, overflow.
// No dependencies: headless Chrome/Edge over CDP with Node's global WebSocket.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 9411;
const URL_BASE = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const BROWSER = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('.design-audit/probe');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT, { recursive: true });
  const profile = mkdtempSync(path.join(tmpdir(), 'cbo-cdp-'));
  const browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i += 1) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* browser not up yet */ }
  }
  if (!target) throw new Error('devtools target not found');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  };

  const shot = async (file, clip) => {
    const { data } = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' });
    writeFileSync(path.join(OUT, file), Buffer.from(data, 'base64'));
  };

  const clickCenter = async (selector) => {
    const box = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) throw new Error(`selector not found: ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL_BASE });
  await sleep(1500);

  const results = {};

  results.default = await evaluate(`({
    lang: document.documentElement.lang,
    dataLang: document.documentElement.dataset.lang,
    title: document.title,
    h1: document.querySelector('h1').innerText.trim().replace(/\\s+/g, ' '),
    trChecked: document.querySelector('input[name=lang][value=tr]').checked,
    imagesOk: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
    imageCount: document.images.length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  })`);

  // English switch, real mouse click on the EN segment
  await clickCenter('.lang-switch .seg:nth-of-type(2)');
  await sleep(400);
  results.switched = await evaluate(`({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelector('h1').innerText.trim().replace(/\\s+/g, ' '),
    enChecked: document.querySelector('input[name=lang][value=en]').checked,
    stored: localStorage.getItem('cbo-site-lang'),
    trVisible: getComputedStyle(document.querySelector('h1 [data-lang="tr"]')).display,
    enVisible: getComputedStyle(document.querySelector('h1 [data-lang="en"]')).display,
    headerWide: document.querySelector('.site-header').classList.contains('is-wide'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  })`);
  await shot('desktop-en-hero.png', { x: 0, y: 0, width: 1440, height: 900 });

  // persistence across a reload
  await send('Page.reload');
  await sleep(1200);
  results.persisted = await evaluate(`({
    lang: document.documentElement.lang,
    enChecked: document.querySelector('input[name=lang][value=en]').checked,
  })`);

  // every lazy image loaded after a full scroll
  results.lazyImages = await evaluate(`(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
    const broken = [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc);
    return { count: document.images.length, broken };
  })()`);

  // mobile: collapsed header, popover menu opens, no horizontal overflow
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  results.mobileCollapsed = await evaluate(`({
    wide: document.querySelector('.site-header').classList.contains('is-wide'),
    menuButtonShown: getComputedStyle(document.querySelector('.menu-button')).display !== 'none',
    menuVisible: getComputedStyle(document.getElementById('site-menu')).display !== 'none',
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  })`);

  await clickCenter('.menu-button');
  await sleep(500);
  results.mobileMenuOpen = await evaluate(`(() => {
    const menu = document.getElementById('site-menu');
    const r = menu.getBoundingClientRect();
    return {
      open: menu.matches(':popover-open'),
      visible: getComputedStyle(menu).display !== 'none',
      insideViewport: r.right <= window.innerWidth + 1 && r.left >= -1 && r.bottom <= window.innerHeight + 1,
      itemCount: menu.querySelectorAll('a').length,
    };
  })()`);
  await shot('mobile-menu-open.png', { x: 0, y: 0, width: 390, height: 400 });

  // light dismiss on Escape, then reopen and jump through a link
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  results.escapeClosed = await evaluate(`({ open: document.getElementById('site-menu').matches(':popover-open') })`);

  await clickCenter('.menu-button');
  await sleep(300);
  await clickCenter('#site-menu a[href="#download"]');
  await sleep(400);
  results.menuJump = await evaluate(`({
    open: document.getElementById('site-menu').matches(':popover-open'),
    hash: location.hash,
    downloadTop: Math.round(document.getElementById('download').getBoundingClientRect().top),
  })`);

  // back to desktop width: the inline navigation must come back
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(600);
  results.backToWide = await evaluate(`({
    wide: document.querySelector('.site-header').classList.contains('is-wide'),
    popoverAttr: document.getElementById('site-menu').hasAttribute('popover'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  })`);

  // full-page capture after the scroll, so the lazy screenshots are in it
  const metrics = await send('Page.getLayoutMetrics');
  const { width, height } = metrics.cssContentSize;
  const full = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  writeFileSync(path.join(OUT, 'full-en.png'), Buffer.from(full.data, 'base64'));

  results.consoleErrors = consoleErrors;

  console.log(JSON.stringify(results, null, 2));

  ws.close();
  browser.kill();
}

main().catch((error) => { console.error('probe failed:', error.message); process.exit(1); });
