import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'standalone', 
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint config removed - use eslint.config.mjs instead
  // Ensure trailing slashes didn't cause 404s
  trailingSlash: false,
  poweredByHeader: false,

  // 禁用页面缓存，解决"幽灵路由"问题
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
