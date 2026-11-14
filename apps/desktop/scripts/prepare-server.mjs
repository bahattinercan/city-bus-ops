import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const requireFromHere = createRequire(import.meta.url)

/**
 * Stages everything the desktop app runs into `apps/desktop/resources/server`:
 *
 * 1. Next's standalone bundle (already self-contained apart from two packages),
 * 2. the static chunks it expects next to the server,
 * 3. the SQLite migration folder (the app applies it on boot),
 * 4. the packages Next's tracing misses in a pnpm workspace (`@swc/helpers`, `@next/env`).
 *
 * Run after `pnpm --filter @citybus/web build`; the desktop package script does that.
 */
const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const web = join(repo, 'apps', 'web')
const target = join(here, '..', 'resources', 'server')

function sizeOf(path) {
  if (!existsSync(path)) return 0
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.size
  return readdirSync(path).reduce((total, entry) => total + sizeOf(join(path, entry)), 0)
}

const checks = [
  [join(web, '.next', 'standalone'), 'Next standalone output — run `pnpm --filter @citybus/web build` first'],
  [join(web, '.next', 'static'), 'Next static output'],
  [join(repo, 'packages', 'db', 'drizzle-sqlite'), 'SQLite migrations — run `pnpm --filter @citybus/db generate` first'],
]
for (const [path, reason] of checks) {
  if (!existsSync(path)) {
    console.error(`missing: ${path}\n${reason}`)
    process.exit(1)
  }
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

console.log('staging standalone server…')
cpSync(join(web, '.next', 'standalone'), target, { recursive: true })
const appInStage = join(target, 'apps', 'web')
mkdirSync(join(appInStage, '.next'), { recursive: true })
cpSync(join(web, '.next', 'static'), join(appInStage, '.next', 'static'), { recursive: true })

console.log('staging migrations…')
cpSync(join(repo, 'packages', 'db', 'drizzle-sqlite'), join(target, 'drizzle-sqlite'), { recursive: true })

// Packages that are required dynamically and that Next's file tracing cannot see through
// pnpm symlinks: Next's own helpers, plus the native-module loader better-sqlite3 uses.
const extras = ['@swc/helpers', '@next/env', 'bindings', 'file-uri-to-path']
for (const name of extras) {
  const from = resolvePackage(name)
  if (from === undefined) {
    console.error(`cannot locate ${name} in the workspace`)
    process.exit(1)
  }
  const to = join(appInStage, 'node_modules', name)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true, dereference: true })
  console.log(`staged ${name}`)
}

function resolvePackage(name) {
  const direct = [join(repo, 'apps', 'web', 'node_modules', name), join(repo, 'node_modules', name)].find((candidate) =>
    existsSync(join(candidate, 'package.json')),
  )
  if (direct !== undefined) return direct

  const store = join(repo, 'node_modules', '.pnpm')
  if (!existsSync(store)) return undefined
  for (const entry of readdirSync(store)) {
    const candidate = join(store, entry, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}

rebuildNativeForElectron()

const megabytes = (sizeOf(target) / 1024 / 1024).toFixed(1)
console.log(`server staged in ${target} (${megabytes} MB)`)

/**
 * better-sqlite3 is a native module: the copy traced from the repo is built for plain Node
 * (ABI 127), while the server child runs inside Electron (ABI 139). Swap in the vendor's
 * prebuilt binary for this Electron version — no Visual Studio build tools required. If the
 * download is unavailable the packaging step fails loudly instead of shipping a dead app.
 */
function rebuildNativeForElectron() {
  const electronBinary = requireFromHere('electron')
  const abiResult = spawnSync(electronBinary, ['-e', 'process.stdout.write(process.versions.modules)'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
  })
  const abi = (abiResult.stdout ?? '').trim()
  if (!/^\d+$/.test(abi)) {
    console.error('cannot determine the Electron module ABI: ' + (abiResult.stderr ?? ''))
    process.exit(1)
  }

  const modules = findDirectories(join(target, 'apps', 'web'), (name) => name.startsWith('better-sqlite3'))
  if (modules.length === 0) {
    console.error('better-sqlite3 was not traced into the standalone bundle')
    process.exit(1)
  }

  for (const moduleDir of modules) {
    const pkg = JSON.parse(readFileSync(join(moduleDir, 'package.json'), 'utf8'))
    const archive = `better-sqlite3-v${pkg.version}-electron-v${abi}-win32-x64.tar.gz`
    const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${archive}`
    console.log(`fetching ${pkg.name}@${pkg.version} for Electron ABI ${abi}…`)

    const work = mkdtempSync(join(tmpdir(), 'bsq-'))
    const file = join(work, archive)
    const download = spawnSync('curl', ['-sSL', '--fail', '-o', file, url], { stdio: 'inherit' })
    if (download.status !== 0) {
      console.error(`could not download ${url} — install Visual Studio build tools and run: npx @electron/rebuild -f -w better-sqlite3`)
      process.exit(1)
    }
    // Git-bash ships GNU tar, which reads "C:\…" as a remote host; the Windows bsdtar does not.
    // Try both, quietly, and fail only when neither can unpack the archive.
    const attempts = [
      ['C:/Windows/System32/tar.exe', ['-xzf', file, '-C', work]],
      ['tar', ['--force-local', '-xzf', file, '-C', work]],
      ['tar', ['-xzf', file, '-C', work]],
    ]
    const extracted = attempts.some(([bin, args]) => spawnSync(bin, args, { stdio: 'ignore' }).status === 0)
    if (!extracted) {
      console.error('could not extract the prebuilt binary')
      process.exit(1)
    }

    const built = join(work, 'build', 'Release', 'better_sqlite3.node')
    const destination = join(moduleDir, 'build', 'Release', 'better_sqlite3.node')
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(built, destination)
    rmSync(work, { recursive: true, force: true })
    console.log(`native module replaced → ${destination}`)
  }
}

function findDirectories(root, predicate) {
  const found = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = join(dir, entry.name)
      if (predicate(entry.name) && existsSync(join(full, 'package.json'))) {
        found.push(full)
        continue
      }
      walk(full)
    }
  }
  walk(root)
  return found
}
