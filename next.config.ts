import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // allow any external domain for news article images
  },
};

export default nextConfig;
