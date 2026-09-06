import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Railway (and other Node hosts) often fail the /_next/image optimizer
  // because sharp's native binary is missing or incompatible. Serve files as-is.
  images: { unoptimized: true },
};

export default nextConfig;
