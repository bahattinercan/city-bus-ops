import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * The web package had no test run of its own: pure helpers it owns (the interface
 * dictionary, label lookups) belong to it, and the alias below is what `@/` means in Next.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts'],
  },
})
