import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["mongoose", "pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
};

export default nextConfig;
