import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Enables the `forbidden()` / `unauthorized()` interrupts used by the
    // RBAC guards in `src/server/auth/dal.ts` (Module 1.4).
    authInterrupts: true,
  },
};

export default nextConfig;
