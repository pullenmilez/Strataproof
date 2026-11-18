import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "firebase-admin", "jspdf"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
