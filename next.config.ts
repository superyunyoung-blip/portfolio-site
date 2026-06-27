import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "etgjbudglpbbqpqcumqk.supabase.co",
      },
    ],
  },
};

export default nextConfig;
