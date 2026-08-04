import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oldschool.runescape.wiki",
      },
    ],
  },
};

export default nextConfig;