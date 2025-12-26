import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone', 
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure trailing slashes didn't cause 404s
  trailingSlash: false,
  poweredByHeader: false,
};

export default nextConfig;
