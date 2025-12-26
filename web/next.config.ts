import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone', // 已禁用，改回默认模式以修复静态资源丢失问题
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  devIndicators: {
    // @ts-ignore - Next.js types might be lagging behind for this specific config
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;
