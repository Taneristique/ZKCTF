import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.0.15", "127.0.0.1", "localhost"],
  turbopack: {},
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-solflare",
  ],
  webpack: (config, { dev }) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, os: false, path: false };
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: ["**/node_modules/**", "**/.git/**"],
        poll: 1000,
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/zk-api/:path*",
        destination: `${(process.env.ZKCTF_API_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
