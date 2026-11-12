import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript sources; Next compiles them in place.
  transpilePackages: ['@citybus/domain', '@citybus/db', '@citybus/gtfs', '@citybus/xlsx'],
}

export default nextConfig
