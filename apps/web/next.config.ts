import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The repository's AGENTS.md is the single contract; Next must not generate another one.
  agentRules: false,
  // Workspace packages ship TypeScript sources; Next compiles them in place.
  transpilePackages: ['@citybus/domain', '@citybus/db', '@citybus/gtfs', '@citybus/xlsx'],
}

export default nextConfig
