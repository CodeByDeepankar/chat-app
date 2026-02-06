import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: '/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;
