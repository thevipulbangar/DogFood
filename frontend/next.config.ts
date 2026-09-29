import type { NextConfig } from "next";

// Self-hosted by design: no remote images, no telemetry-dependent features.
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
