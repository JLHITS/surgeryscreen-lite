import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for slim Docker images.
  output: "standalone",
  // Native / server-only packages that must not be bundled by Next.
  serverExternalPackages: ["better-sqlite3", "sharp", "pg"],
  // We serve and size our own images (via /api/media and the publish
  // pipeline), so Next's built-in image optimizer is unnecessary.
  images: { unoptimized: true },
  // sharp's native binary + libvips shared library live in separate platform
  // packages that file-tracing misses, so on serverless hosts the routes that
  // use sharp (upload + publish) fail with "cannot open libvips-cpp.so". Force
  // the Linux x64 binaries into those bundles. (Keys are matched as
  // substrings, so this covers /api/admin/practices/[slug]/slides and /publish.)
  outputFileTracingIncludes: {
    "/api/admin": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
