import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Turbopack is the default bundler in Next.js 16+.
     next-pwa relies on webpack, so we keep an empty turbopack
     config to silence the error and let the build proceed. */
  turbopack: {},
};

export default nextConfig;
