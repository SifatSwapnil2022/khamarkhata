import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers load native/WASM pieces and WebSocket internals at runtime; bundling them breaks that.
  serverExternalPackages: ["@electric-sql/pglite", "@netlify/database", "@neondatabase/serverless", "ws", "pg", "postgres"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
