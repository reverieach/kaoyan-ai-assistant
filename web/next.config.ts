import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: {
    // @ts-ignore - Next.js types might be lagging behind for this specific config
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;
