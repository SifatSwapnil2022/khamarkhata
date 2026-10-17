import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database drivers load native/WASM pieces and WebSocket internals at runtime; bundling them breaks that.
  serverExternalPackages: ["@electric-sql/pglite", "@netlify/database", "@neondatabase/serverless", "ws", "pg", "postgres"],
  poweredByHeader: false,
  // Animal photos are shrunk on the phone to well under 1 MB; this leaves room for the form around them.
  experimental: { serverActions: { bodySizeLimit: "1.5mb" } },
  images: {
    // Unsplash and Pexels photos are resized by their own CDNs; see the loader.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
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
