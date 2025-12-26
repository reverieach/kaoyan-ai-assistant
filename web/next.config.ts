import type { NextConfig } from "next";

// output: 'standalone', // 已禁用，改回默认模式以修复静态资源丢失问题
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
