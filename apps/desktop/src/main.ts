import { spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { randomBytes } from 'node:crypto'

/**
 * Desktop shell for the planner.
 *
 * The Next.js server is the product; this process owns its lifecycle: one free port on
 * 127.0.0.1, the SQLite file in the user data directory, a health gate before the window
 * appears, rotating backups, and a readable error instead of a white screen when the server
 * cannot start. Nothing here contains business rules.
 */

const APP_NAME = 'CityBusOps'
const HEALTH_TIMEOUT_MS = 45_000
const BACKUPS_TO_KEEP = 14

type Config = {
  readonly tenantSlug: string
  readonly sessionSecret: string
  readonly rotationAnchorWeek?: string
  readonly organisationName?: string
  readonly assistant: {
    readonly enabled: boolean
    readonly baseUrl: string
    readonly model: string
    readonly apiKey: string
  }
  readonly window: { readonly width: number; readonly height: number; readonly x?: number; readonly y?: number }
}

const paths = {
  get dataDir() {
    return app.getPath('userData')
  },
  get config() {
    return join(paths.dataDir, 'config.json')
  },
  get database() {
    return join(paths.dataDir, 'citybus.db')
  },
  get backups() {
    return join(paths.dataDir, 'backups')
  },
  get logs() {
    return join(paths.dataDir, 'logs')
  },
  get serverDir() {
    return app.isPackaged
      ? join(process.resourcesPath, 'server')
      : join(app.getAppPath(), 'resources', 'server')
  },
  get serverEntry() {
    return join(paths.serverDir, 'apps', 'web', 'server.js')
  },
  get migrations() {
    return join(paths.serverDir, 'drizzle-sqlite')
  },
  get errorPage() {
    return app.isPackaged
      ? join(process.resourcesPath, 'error.html')
      : join(app.getAppPath(), 'resources', 'error.html')
  },
}

let serverProcess: ChildProcess | undefined
let mainWindow: BrowserWindow | undefined
let serverPort = 0
let shuttingDown = false

function log(line: string): void {
  try {
    mkdirSync(paths.logs, { recursive: true })
    appendFileSync(join(paths.logs, 'app.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Logging must never take the app down.
  }
}

function readConfig(): { config: Config; firstRun: boolean } {
  mkdirSync(paths.dataDir, { recursive: true })
  if (existsSync(paths.config)) {
    const parsed = JSON.parse(readFileSync(paths.config, 'utf8')) as Config
    // A secret written by an older build stays; nothing is regenerated silently.
    return { config: parsed, firstRun: false }
  }

  const created: Config = {
    tenantSlug: 'kutahya',
    sessionSecret: randomBytes(32).toString('hex'),
    assistant: { enabled: false, baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', apiKey: '' },
    window: { width: 1440, height: 900 },
  }
  writeFileSync(paths.config, JSON.stringify(created, null, 2), 'utf8')
  log(`config created at ${paths.config}`)
  return { config: created, firstRun: true }
}

function saveConfig(config: Config): void {
  writeFileSync(paths.config, JSON.stringify(config, null, 2), 'utf8')
}

/** A free loopback port: the operator never sees "port already in use". */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no free port'))))
    })
  })
}

/**
 * Copies the database next to itself before the server touches it. The SQLite manual allows
 * copying `.db` + `-wal` + `-shm` together, which is what a running desktop app can do without
 * dragging the native driver into the shell.
 */
function backupDatabase(): void {
  if (!existsSync(paths.database)) return
  mkdirSync(paths.backups, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const folder = join(paths.backups, `citybus-${stamp}`)
  mkdirSync(folder, { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    const source = `${paths.database}${suffix}`
    if (existsSync(source)) cpSync(source, join(folder, `citybus.db${suffix}`))
  }

  const folders = readdirSync(paths.backups)
    .filter((name) => name.startsWith('citybus-'))
    .sort()
  for (const stale of folders.slice(0, Math.max(0, folders.length - BACKUPS_TO_KEEP))) {
    rmSync(join(paths.backups, stale), { recursive: true, force: true })
  }
  log(`backup written: ${folder}`)
}

function startServer(config: Config, port: number): ChildProcess {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Electron's own Node: no second runtime to ship or patch.
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
    CITYBUS_DB_FILE: paths.database,
    CITYBUS_MIGRATIONS_DIR: paths.migrations,
    CITYBUS_TENANT_SLUG: config.tenantSlug,
    // One workstation, no password: the sidebar switches the working role.
    CITYBUS_LOCAL_MODE: '1',
    SESSION_SECRET: config.sessionSecret,
    ASSISTANT_ENABLED: config.assistant.enabled ? 'true' : 'false',
    ASSISTANT_BASE_URL: config.assistant.baseUrl,
    ASSISTANT_MODEL: config.assistant.model,
    ASSISTANT_API_KEY: config.assistant.apiKey,
  }

  const child = spawn(process.execPath, [paths.serverEntry], { cwd: paths.serverDir, env, stdio: 'pipe' })
  const stream = (chunk: Buffer) => {
    try {
      mkdirSync(paths.logs, { recursive: true })
      appendFileSync(join(paths.logs, 'server.log'), chunk)
    } catch {
      // ignore log failures
    }
  }
  child.stdout?.on('data', stream)
  child.stderr?.on('data', stream)
  child.on('exit', (code) => {
    log(`server exited with code ${code}`)
    if (!shuttingDown) {
      void dialog.showMessageBox({
        type: 'error',
        title: 'Sunucu durdu',
        message: `Uygulama sunucusu beklenmedik şekilde kapandı (kod ${code ?? 'yok'}).`,
        detail: `Ayrıntılar: ${join(paths.logs, 'server.log')}`,
        buttons: ['Kapat'],
      }).then(() => app.quit())
    }
  })
  return child
}

async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) })
      if (response.ok) return true
    } catch {
      // not listening yet
    }
    if (serverProcess?.exitCode !== undefined && serverProcess.exitCode !== null) return false
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

function buildMenu(config: Config): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'Veritabanını yedekle',
          click: () => {
            backupDatabase()
            void shell.openPath(paths.backups)
          },
        },
        { label: 'Yedek klasörünü aç', click: () => void shell.openPath(paths.backups) },
        { label: 'Veri klasörünü aç', click: () => void shell.openPath(paths.dataDir) },
        { type: 'separator' },
        { label: 'Çıkış', role: 'quit' },
      ],
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', role: 'reload' },
        { label: 'Yakınlaştır', role: 'zoomIn' },
        { label: 'Uzaklaştır', role: 'zoomOut' },
        { label: 'Normal boyut', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tam ekran', role: 'togglefullscreen' },
        { label: 'Geliştirici araçları', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'Nasıl kullanılır',
          click: () => {
            if (serverPort > 0) void shell.openExternal(`http://127.0.0.1:${serverPort}/help`)
          },
        },
        {
          label: 'Hakkında',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'City Bus Ops',
              message: 'City Bus Ops — şehir içi otobüs operasyon sistemi',
              detail: [
                `Sürüm: ${app.getVersion()}`,
                `Veritabanı: ${paths.database}`,
                `Kurum: ${config.tenantSlug}`,
                '',
                'Tüm veriler bu bilgisayarda kalır; internet gerekmez.',
              ].join('\n'),
              buttons: ['Tamam'],
            })
          },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(config: Config): BrowserWindow {
  const window = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    ...(config.window.x === undefined ? {} : { x: config.window.x }),
    ...(config.window.y === undefined ? {} : { y: config.window.y }),
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a1420',
    show: false,
    title: 'City Bus Ops',
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('close', () => {
    const bounds = window.getBounds()
    saveConfig({ ...config, window: { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y } })
  })

  // The app never navigates away from its own loopback server.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  void window.loadFile(paths.errorPage)
  return window
}

async function boot(config: Config): Promise<void> {
  backupDatabase()

  if (!existsSync(paths.serverEntry)) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Kurulum eksik',
      message: 'Uygulama sunucusu bulunamadı.',
      detail: `Beklenen dosya: ${paths.serverEntry}\n\nGeliştirme sırasında önce "pnpm --filter @citybus/desktop prepare:server" çalıştırın.`,
      buttons: ['Kapat'],
    })
    app.quit()
    return
  }

  serverPort = await freePort()
  serverProcess = startServer(config, serverPort)
  log(`server starting on 127.0.0.1:${serverPort} (db ${paths.database})`)

  const healthy = await waitForHealth(serverPort, HEALTH_TIMEOUT_MS)
  if (!healthy) {
    log('server did not become healthy in time')
    const window = createWindow(config)
    await window.loadFile(paths.errorPage, {
      query: {
        reason: 'Sunucu zamanında açılmadı.',
        detail: `Günlük dosyası: ${join(paths.logs, 'server.log')}`,
      },
    })
    window.show()
    return
  }

  log('server healthy')
  const window = createWindow(config)
  await window.loadURL(`http://127.0.0.1:${serverPort}/`)
  mainWindow = window
}

async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  backupDatabase()

  const child = serverProcess
  serverProcess = undefined
  if (child !== undefined && child.exitCode === null) {
    child.kill()
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
}

async function selfTest(): Promise<void> {
  const { config } = readConfig()
  serverPort = await freePort()
  serverProcess = startServer(config, serverPort)
  const healthy = await waitForHealth(serverPort, HEALTH_TIMEOUT_MS)
  const result = {
    selfTest: healthy ? 'ok' : 'failed',
    port: serverPort,
    database: paths.database,
    migrations: paths.migrations,
    migrationsPresent: existsSync(paths.migrations),
    serverEntry: paths.serverEntry,
    serverEntryPresent: existsSync(paths.serverEntry),
    logs: paths.logs,
    electron: process.versions.electron,
    node: process.versions.node,
  }
  serverProcess?.kill()
  console.log(JSON.stringify(result, null, 2))
  app.exit(healthy ? 0 : 1)
}

app.setName(APP_NAME)

if (process.argv.includes('--self-test')) {
  app.whenReady().then(selfTest)
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow !== undefined) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    const { config } = readConfig()
    buildMenu(config)
    await boot(config)
  })

  app.on('before-quit', (event) => {
    if (!shuttingDown) {
      event.preventDefault()
      void shutdown().then(() => app.quit())
    }
  })

  app.on('window-all-closed', () => app.quit())

  process.on('uncaughtException', (error) => {
    log(`uncaught: ${error.stack ?? error.message}`)
  })
}
