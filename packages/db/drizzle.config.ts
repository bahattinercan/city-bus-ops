import { defineConfig } from 'drizzle-kit'

/**
 * SQLite is the single dialect of the desktop application (docs/09-desktop-app.md).
 * The file path only matters for `generate`; `migrate` runs from the app against the
 * database the shell hands it.
 */
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle-sqlite',
  dialect: 'sqlite',
  dbCredentials: { url: process.env.CITYBUS_DB_FILE ?? './data/citybus.db' },
  strict: true,
  verbose: true,
})
