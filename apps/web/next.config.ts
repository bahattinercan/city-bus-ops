import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repository's AGENTS.md is the single contract; Next must not generate another one.
  agentRules: false,
  // Workspace packages ship TypeScript sources; Next compiles them in place.
  transpilePackages: ['@citybus/domain', '@citybus/db', '@citybus/gtfs', '@citybus/xlsx'],
  // The desktop shell runs this build from a copied folder (apps/web/.next/standalone),
  // so the server bundle must be self-contained.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
}

export default nextConfig
