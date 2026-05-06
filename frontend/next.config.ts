import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep file watching scoped to the frontend app only.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
