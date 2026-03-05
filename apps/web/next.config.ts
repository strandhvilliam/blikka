import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  reactCompiler: true,
  cacheComponents: true,
  // Externalize server-only packages to prevent bundling issues with Node.js-specific modules
  serverExternalPackages: ["exifr", "sharp"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },
}

export default withNextIntl(nextConfig)
