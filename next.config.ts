import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/pools/[championshipId]/agreement": [
      "./node_modules/pdfkit/js/data/**/*",
    ],
  },
};

export default nextConfig;
