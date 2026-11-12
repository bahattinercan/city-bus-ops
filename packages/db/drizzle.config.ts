import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env first')
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
